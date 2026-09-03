#!/usr/bin/env node
import { resolve } from "node:path";
import { startServer } from "./mcp/server.js";

const vaultRoot = resolve(process.env.STORY_VAULT_ROOT ?? "story-vault");
const allowWrites = process.env.STORY_VAULT_ALLOW_WRITES === "1";

startServer({ vaultRoot, allowWrites }).catch((error) => {
  process.stderr.write(
    `Story Vault MCP failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
