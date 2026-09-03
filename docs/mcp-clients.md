# MCP client setup

Build and link the package first:

```bash
npm install
npm link
```

The CLI generates an absolute command and vault path, avoiding shell-specific `~` expansion and hardcoded paths from another machine.

## Codex

```bash
story-vault install-skill --client codex
story-vault config --client codex --vault ~/Documents/my-story-vault
```

Append the output to `~/.codex/config.toml`, then restart Codex.

## Claude Code / Claude Desktop

```bash
story-vault install-skill --client claude
story-vault config --client claude --vault ~/Documents/my-story-vault
```

Merge the printed `story_vault` entry into the client’s existing `mcpServers` object. Do not replace unrelated server entries.

## Cursor

```bash
story-vault config --client cursor --vault ~/Documents/my-story-vault
```

Merge the printed entry into the project or user MCP configuration and restart Cursor.

## Curation mode

Add `--write` to the config command only while creating or revising story cards. It sets `STORY_VAULT_ALLOW_WRITES=1`. The MCP server then permits `upsert_story`, which creates a story and reciprocal essay backlinks.

After curation, regenerate the configuration without `--write`. Restarting the client is necessary because stdio MCP servers inherit environment variables when launched.

## Troubleshooting

Run these checks before debugging the AI client:

```bash
story-vault validate --vault ~/Documents/my-story-vault
story-vault stats --vault ~/Documents/my-story-vault
story-vault mcp --vault ~/Documents/my-story-vault
```

The last command waits silently for MCP messages on standard input; silence means startup succeeded. Press `Ctrl-C` to stop it. Protocol messages use standard output, so diagnostics are written only to standard error.
