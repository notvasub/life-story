import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type ClientName = "codex" | "claude" | "cursor";

function commandConfig(vaultRoot: string, write: boolean) {
  return {
    command: process.execPath,
    args: [join(dirname(fileURLToPath(import.meta.url)), "mcp-entry.js")],
    env: {
      STORY_VAULT_ROOT: resolve(vaultRoot),
      ...(write ? { STORY_VAULT_ALLOW_WRITES: "1" } : {}),
    },
  };
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

export function renderClientConfig(
  client: ClientName,
  vaultRoot: string,
  write = false,
): string {
  const config = commandConfig(vaultRoot, write);
  if (client === "codex") {
    return `[mcp_servers.story_vault]\ncommand = ${tomlString(config.command)}\nargs = [${config.args.map(tomlString).join(", ")}]\nstartup_timeout_sec = 30\n\n[mcp_servers.story_vault.env]\n${Object.entries(
      config.env,
    )
      .map(([key, value]) => `${key} = ${tomlString(value)}`)
      .join("\n")}\n`;
  }
  return `${JSON.stringify({ mcpServers: { story_vault: config } }, null, 2)}\n`;
}
