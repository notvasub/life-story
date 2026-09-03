import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getDocument, listDocuments } from "../vault/document.js";
import { upsertStory, vaultStats } from "../vault/manage.js";
import { searchVault } from "../vault/search.js";

function text(value: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text:
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function failure(error: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: error instanceof Error ? error.message : String(error),
      },
    ],
    isError: true,
  };
}

const searchStorySchema = {
  query: z
    .string()
    .describe("Words or phrases from the prompt or desired story."),
  themes: z.array(z.string()).default([]),
  best_for: z.array(z.string()).default([]),
  tone: z.array(z.string()).default([]),
  limit: z.number().int().min(1).max(20).default(8),
  include_snippets: z.boolean().default(true),
};
const searchEssaySchema = {
  query: z.string(),
  limit: z.number().int().min(1).max(20).default(8),
  include_snippets: z.boolean().default(true),
};
const idSchema = { id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/) };

export interface ServerOptions {
  vaultRoot: string;
  allowWrites?: boolean;
}

export function buildServer(options: ServerOptions): McpServer {
  const server = new McpServer({ name: "story-vault", version: "1.0.0" });

  server.registerTool(
    "search_stories",
    {
      description:
        "Search curated personal stories by prompt language, themes, use cases, and emotional tone.",
      inputSchema: searchStorySchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) =>
      text(
        searchVault({
          vaultRoot: options.vaultRoot,
          collection: "stories",
          query: input.query,
          filters: {
            primary_themes: input.themes,
            best_for: input.best_for,
            emotional_tone: input.tone,
          },
          limit: input.limit,
          contextLines: input.include_snippets ? 2 : 0,
        }),
      ),
  );

  server.registerTool(
    "get_story",
    {
      description:
        "Read one complete curated story and its linked source essay IDs.",
      inputSchema: idSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        return text(getDocument(options.vaultRoot, "stories", id).markdown);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "search_essays",
    {
      description:
        "Search imported essays, applications, and notes and return compact excerpts.",
      inputSchema: searchEssaySchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) =>
      text(
        searchVault({
          vaultRoot: options.vaultRoot,
          collection: "essays",
          query: input.query,
          limit: input.limit,
          contextLines: input.include_snippets ? 2 : 0,
        }),
      ),
  );

  server.registerTool(
    "get_essay",
    {
      description: "Read one complete source essay by ID.",
      inputSchema: idSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        return text(getDocument(options.vaultRoot, "essays", id).markdown);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "search_excerpts",
    {
      description:
        "Search stories and source essays together for reusable details or distinctive phrases.",
      inputSchema: {
        query: z.string(),
        limit: z.number().int().min(1).max(20).default(5),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, limit }) =>
      text({
        stories: searchVault({
          vaultRoot: options.vaultRoot,
          collection: "stories",
          query,
          limit,
          contextLines: 2,
        }),
        essays: searchVault({
          vaultRoot: options.vaultRoot,
          collection: "essays",
          query,
          limit,
          contextLines: 2,
        }),
      }),
  );

  server.registerTool(
    "list_essays",
    {
      description:
        "List imported essay metadata in stable pages. Use during initial story curation.",
      inputSchema: {
        cursor: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(50).default(20),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ cursor, limit }) => {
      const essays = listDocuments(options.vaultRoot, "essays");
      const items = essays.slice(cursor, cursor + limit).map((essay) => ({
        id: essay.id,
        title: essay.frontmatter.title,
        kind: essay.frontmatter.kind,
        status: essay.frontmatter.status,
        word_count: essay.frontmatter.word_count,
        stories: essay.frontmatter.stories,
      }));
      return text({
        items,
        next_cursor: cursor + limit < essays.length ? cursor + limit : null,
        total: essays.length,
      });
    },
  );

  server.registerTool(
    "list_use_cases",
    {
      description: "List optional retrieval profiles stored in the vault.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      text(
        listDocuments(options.vaultRoot, "use-cases").map((item) => ({
          id: item.id,
          title: item.frontmatter.title,
        })),
      ),
  );

  server.registerTool(
    "get_use_case",
    {
      description: "Read one retrieval profile by ID.",
      inputSchema: idSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      try {
        return text(getDocument(options.vaultRoot, "use-cases", id).markdown);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "vault_stats",
    {
      description: "Report the configured vault location and document counts.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => text(vaultStats(options.vaultRoot)),
  );

  server.registerTool(
    "upsert_story",
    {
      description:
        "Create or update a curated story and link it to existing source essays. Disabled unless STORY_VAULT_ALLOW_WRITES=1.",
      inputSchema: {
        id: z.string().optional(),
        title: z.string().min(1),
        summary: z.string().min(1),
        details: z.string().optional(),
        primary_themes: z.array(z.string()).default([]),
        secondary_themes: z.array(z.string()).default([]),
        best_for: z.array(z.string()).default([]),
        avoid_for: z.array(z.string()).default([]),
        emotional_tone: z.array(z.string()).default([]),
        source_essays: z.array(z.string()).default([]),
        related_stories: z.array(z.string()).default([]),
        status: z.enum(["candidate", "ready", "archived"]).default("candidate"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      if (!options.allowWrites) {
        return failure(
          "Story writes are disabled. Generate MCP config with `story-vault config --write`, restart the client, and explicitly ask to curate the vault.",
        );
      }
      try {
        const id = upsertStory(options.vaultRoot, {
          id: input.id,
          title: input.title,
          summary: input.summary,
          details: input.details,
          primaryThemes: input.primary_themes,
          secondaryThemes: input.secondary_themes,
          bestFor: input.best_for,
          avoidFor: input.avoid_for,
          emotionalTone: input.emotional_tone,
          sourceEssays: input.source_essays,
          relatedStories: input.related_stories,
          status: input.status,
        });
        return text({ id, updated: true });
      } catch (error) {
        return failure(error);
      }
    },
  );

  return server;
}

export async function startServer(options: ServerOptions): Promise<void> {
  const server = buildServer(options);
  await server.connect(new StdioServerTransport());
}
