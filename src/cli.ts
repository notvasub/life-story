#!/usr/bin/env node
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderClientConfig, type ClientName } from "./config.js";
import { readSourceDocuments } from "./importer/readSources.js";
import { startServer } from "./mcp/server.js";
import { resolveUserPath } from "./shared/files.js";
import {
  installSkill,
  initializeVault,
  importDocuments,
  vaultStats,
} from "./vault/manage.js";
import { searchVault } from "./vault/search.js";
import { validateVault } from "./vault/validate.js";
import type { VaultCollection } from "./vault/types.js";

const VERSION = "1.0.0";
const HELP = `Story Vault — local-first retrieval for your personal writing

Usage:
  story-vault init [vault]                         Create an empty vault
  story-vault import <export.zip|directory>        Import a Notion export
  story-vault search <query>                       Search the local vault
  story-vault validate                             Check links and structure
  story-vault stats                                Show document counts
  story-vault config [--client codex|claude|cursor] Print MCP configuration
  story-vault install-skill [--client codex|claude] Install the bundled skill
  story-vault mcp                                  Start the stdio MCP server

Common options:
  --vault <path>       Vault directory (default: STORY_VAULT_ROOT or ./story-vault)
  --write              Enable upsert_story in MCP configuration/server
  --force              Replace an existing installed skill
  --help                Show help
  --version             Show version

Quick start:
  story-vault init
  story-vault import ~/Downloads/Notion-Export.zip
  story-vault install-skill --client codex
  story-vault config --client codex
`;

function optionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function positional(args: string[]): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (
      ["--vault", "--client", "--collection", "--limit"].includes(args[index])
    )
      index += 1;
    else if (!args[index].startsWith("--")) values.push(args[index]);
  }
  return values;
}

function clientName(value: string | undefined, allowCursor = true): ClientName {
  const client = value ?? "codex";
  if (
    client === "codex" ||
    client === "claude" ||
    (allowCursor && client === "cursor")
  )
    return client;
  throw new Error(`Unsupported client: ${client}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args[0] === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (args.includes("--version") || args[0] === "version") {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  const command = args[0];
  const rest = args.slice(1);
  const items = positional(rest);
  const vaultRoot = resolveUserPath(
    optionValue(rest, "--vault") ??
      process.env.STORY_VAULT_ROOT ??
      "story-vault",
  );

  if (command === "init") {
    initializeVault(resolveUserPath(items[0] ?? vaultRoot));
    process.stdout.write(
      `Created story vault at ${resolveUserPath(items[0] ?? vaultRoot)}\n`,
    );
    return;
  }
  if (command === "import") {
    if (!items[0])
      throw new Error("Provide a Notion export ZIP, directory, or document.");
    const sourcePath = resolveUserPath(items[0]);
    const documents = readSourceDocuments(sourcePath);
    if (documents.length === 0)
      throw new Error(
        "No supported writing files were found. Export Notion as Markdown & CSV.",
      );
    const result = importDocuments(documents, vaultRoot);
    process.stdout.write(
      `Imported ${result.imported} documents (${result.skipped} unchanged) into ${result.vaultRoot}\n`,
    );
    return;
  }
  if (command === "search") {
    if (items.length === 0) throw new Error("Provide a search query.");
    const collection = (optionValue(rest, "--collection") ??
      "stories") as VaultCollection;
    if (!(["stories", "essays", "use-cases"] as string[]).includes(collection))
      throw new Error(`Invalid collection: ${collection}`);
    const limit = Number(optionValue(rest, "--limit") ?? 8);
    process.stdout.write(
      `${JSON.stringify(searchVault({ vaultRoot, collection, query: items.join(" "), limit, contextLines: 2 }), null, 2)}\n`,
    );
    return;
  }
  if (command === "validate") {
    const report = validateVault(vaultRoot);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.valid) process.exitCode = 1;
    return;
  }
  if (command === "stats") {
    process.stdout.write(`${JSON.stringify(vaultStats(vaultRoot), null, 2)}\n`);
    return;
  }
  if (command === "config") {
    process.stdout.write(
      renderClientConfig(
        clientName(optionValue(rest, "--client")),
        vaultRoot,
        rest.includes("--write"),
      ),
    );
    return;
  }
  if (command === "install-skill") {
    const client = clientName(optionValue(rest, "--client"), false);
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const source = join(packageRoot, "skill", "story-retriever");
    const target = join(
      homedir(),
      client === "codex"
        ? ".codex/skills/story-retriever"
        : ".claude/skills/story-retriever",
    );
    process.stdout.write(
      `Installed skill at ${installSkill(source, target, rest.includes("--force"))}\n`,
    );
    return;
  }
  if (command === "mcp") {
    if (!existsSync(vaultRoot))
      throw new Error(
        `Vault not found: ${vaultRoot}. Run story-vault init first.`,
      );
    await startServer({
      vaultRoot,
      allowWrites:
        rest.includes("--write") ||
        process.env.STORY_VAULT_ALLOW_WRITES === "1",
    });
    return;
  }
  throw new Error(`Unknown command: ${command}\n\n${HELP}`);
}

main().catch((error) => {
  process.stderr.write(
    `Error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
