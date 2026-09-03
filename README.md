# Life Story Vault

Turn years of essays, applications, and notes into a private story library your AI assistant can actually search.

Life Story Vault imports a Notion export, stores the writing as ordinary Markdown, connects recurring experiences into reusable story threads, and exposes the result through a local [Model Context Protocol](https://modelcontextprotocol.io/) server. The bundled `story-retriever` skill then finds evidence-backed stories for application, scholarship, interview, portfolio, and reflective-writing prompts.

Your writing stays on your computer. There is no account, hosted database, telemetry, or required API key.

## What it does

- Imports Notion Markdown/CSV or HTML exports from a ZIP or directory.
- Preserves full source text and paths in Obsidian-compatible Markdown.
- Gives every document a deterministic ID, so re-imports are safe.
- Searches story themes, prompt fits, emotional tone, source essays, and full text.
- Lets an AI assistant curate recurring experiences with an explicitly enabled MCP write tool.
- Connects stories and essays with `[[wikilinks]]` for an instant Obsidian graph.
- Ships one portable skill and generated configuration for Codex, Claude, and Cursor.

```mermaid
flowchart LR
  A[Notion export] --> B[Local importer]
  B --> C[Markdown essays]
  C --> D[AI-assisted curation]
  D --> E[Connected story vault]
  E --> F[Local MCP search]
  F --> G[Story Retriever skill]
```

## Quick start

Requirements: Node.js 20 or newer and an MCP-capable AI client.

```bash
git clone https://github.com/notvasub/life-story.git
cd life-story
npm install
npm link
```

Export the relevant Notion page with **Markdown & CSV** and **Include subpages** enabled. You can pass the downloaded ZIP directly:

```bash
story-vault init ~/Documents/my-story-vault
story-vault import ~/Downloads/notion-export.zip --vault ~/Documents/my-story-vault
story-vault install-skill --client codex
story-vault config --client codex --vault ~/Documents/my-story-vault
```

Paste the printed configuration into `~/.codex/config.toml`, restart Codex, and ask:

```text
Use $story-retriever to find my strongest story for this prompt:
[paste prompt]
```

The same `config` command supports `--client claude` and `--client cursor`. See [MCP client setup](docs/mcp-clients.md) for exact locations and the initial curation flow.

## Initial story curation

Importing creates searchable essay records. Curation turns recurring experiences across those records into higher-quality story cards.

1. Generate a temporarily write-enabled client configuration:

   ```bash
   story-vault config --client codex --vault ~/Documents/my-story-vault --write
   ```

2. Restart the client and explicitly ask:

   ```text
   Use $story-retriever to curate my imported story vault. Group recurring experiences, read the source essays, and create source-backed story cards.
   ```

3. Review `stories/` in any editor or open the vault in Obsidian.
4. Replace the configuration with the normal read-only version and restart the client.

Writes are off by default. Even in curation mode, the MCP server exposes only an idempotent `upsert_story` operation—no delete tool.

## Everyday use

```text
Use $story-retriever for this 250-word leadership prompt. I already used the garden story elsewhere in the application.
```

The skill searches broadly, reads the complete top stories and their linked source essays, then returns ranked recommendations, reusable details, risks, and adaptation advice. It does not invent experiences and does not draft unless asked.

You can also inspect the vault without an AI client:

```bash
story-vault stats --vault ~/Documents/my-story-vault
story-vault search "leadership conflict" --vault ~/Documents/my-story-vault
story-vault search "soil sensor" --collection essays --vault ~/Documents/my-story-vault
story-vault validate --vault ~/Documents/my-story-vault
```

## Vault layout

```text
my-story-vault/
├── 00-index/
│   ├── essays.json
│   ├── stories.json
│   └── story-map.md
├── essays/       # Imported source material
├── stories/      # Curated reusable experiences
├── use-cases/    # Optional retrieval profiles
└── README.md
```

Markdown remains the source of truth. JSON indexes are regenerated navigation aids, not a database. The app can therefore be removed without trapping your data.

## Import behavior

Supported source files are `.md`, `.markdown`, `.txt`, `.html`, `.htm`, and `.csv`. Images and other attachments are ignored. Empty/navigation-only documents are skipped. Notion’s trailing 32-character page IDs are removed from display titles but the original relative path is preserved.

Re-running an import updates documents with the same deterministic ID and preserves their story backlinks. Export instructions are in [Notion import guide](docs/notion-export.md); Notion also maintains an [official export guide](https://www.notion.com/help/export-your-content).

## Privacy and security

The MCP server only reads within the configured vault, rejects traversal IDs, ignores symlinks during search, and resolves real paths before reading. Imported content is treated as data rather than agent instructions. Keep the generated vault out of public Git repositories; it probably contains deeply personal material.

Read [Privacy and security](docs/privacy-and-security.md) before enabling writes or connecting a cloud-hosted AI client.

## Development

```bash
npm install
npm run check
npm run dev -- --help
npm pack --dry-run
```

The project targets Node 20+ and uses TypeScript, Vitest, the MCP TypeScript SDK, YAML, and fflate. See [Architecture](docs/architecture.md) and [Contributing](CONTRIBUTING.md).

## Project status

Version 1.0 is intentionally local-first and export-based. It does not continuously sync with Notion, call an LLM itself, host your data, or submit applications. Those constraints keep setup understandable and personal writing portable.

## License

[MIT](LICENSE) © 2026 Vasu Bansal.
