import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readSourceDocuments } from "../src/importer/readSources.js";
import { buildServer } from "../src/mcp/server.js";
import { importDocuments } from "../src/vault/manage.js";

const clients: Client[] = [];
afterEach(async () =>
  Promise.all(clients.splice(0).map((client) => client.close())),
);

async function connectedClient(allowWrites = false): Promise<Client> {
  const root = mkdtempSync(join(tmpdir(), "story-mcp-"));
  importDocuments(
    readSourceDocuments(join(import.meta.dirname, "fixtures/notion-export")),
    root,
  );
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = buildServer({ vaultRoot: root, allowWrites });
  await server.server.connect(serverTransport);
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(clientTransport);
  clients.push(client);
  return client;
}

describe("MCP contract", () => {
  it("exposes the documented tools and searches essays", async () => {
    const client = await connectedClient();
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "search_stories",
        "get_story",
        "search_essays",
        "get_essay",
        "search_excerpts",
        "list_essays",
        "upsert_story",
      ]),
    );
    const result = await client.callTool({
      name: "search_essays",
      arguments: { query: "sensor" },
    });
    expect(JSON.stringify(result.content)).toContain("Sensor Project");
  });

  it("keeps writes disabled unless explicitly configured", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "upsert_story",
      arguments: { title: "New", summary: "Summary" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("writes are disabled");
  });
});
