import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const sandbox = mkdtempSync(join(tmpdir(), "life-story-vault-release-"));

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

try {
  run("npm", ["pack", "--pack-destination", sandbox]);
  const archive = join(
    sandbox,
    basename(
      run("npm", ["pack", "--dry-run", "--json"]).match(
        /"filename":\s*"([^"]+)"/,
      )?.[1] ?? "life-story-vault-1.0.0.tgz",
    ),
  );
  if (!existsSync(archive))
    throw new Error(`Package archive not found: ${archive}`);

  const consumerRoot = join(sandbox, "consumer");
  run("npm", ["install", "--prefix", consumerRoot, archive]);
  const cli = join(consumerRoot, "node_modules", ".bin", "story-vault");
  const vault = join(sandbox, "vault");
  const fixture = join(repositoryRoot, "tests", "fixtures", "notion-export");

  run(process.execPath, [cli, "init", vault]);
  run(process.execPath, [cli, "import", fixture, "--vault", vault]);
  const stats = JSON.parse(
    run(process.execPath, [cli, "stats", "--vault", vault]),
  );
  const validation = JSON.parse(
    run(process.execPath, [cli, "validate", "--vault", vault]),
  );
  const config = run(process.execPath, [
    cli,
    "config",
    "--client",
    "codex",
    "--vault",
    vault,
  ]);

  if (stats.essays !== 2 || stats.stories !== 0 || !validation.valid) {
    throw new Error(
      `Unexpected consumer results: ${JSON.stringify({ stats, validation })}`,
    );
  }
  if (!config.includes(vault) || config.includes("STORY_VAULT_ALLOW_WRITES")) {
    throw new Error("Read-only generated MCP configuration is incorrect.");
  }

  process.stdout.write(
    `Package smoke passed: imported ${stats.essays} synthetic essays into an isolated vault.\n`,
  );
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
