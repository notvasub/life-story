# Architecture

Life Story Vault separates deterministic data handling from subjective story judgment.

## Import layer

`src/importer` accepts a ZIP, directory, or individual document. It normalizes supported source formats and emits source documents without changing the original export. Stable IDs make the operation idempotent.

## Vault layer

`src/vault` writes Obsidian-compatible Markdown, indexes metadata, validates cross-links, and performs weighted local search. Story and essay files are authoritative; `00-index` can always be regenerated.

## MCP layer

`src/mcp` exposes small, composable stdio tools. Search tools return IDs and short excerpts; `get_*` tools provide full records only after selection. Filesystem access is restricted to the configured root and symlinks are not traversed.

The sole mutation tool, `upsert_story`, is absent in effect unless write mode is explicitly enabled. It is idempotent and cannot delete source writing.

## Skill layer

`skill/story-retriever` tells an AI assistant when to search, when to read complete evidence, how to rank story fit, and how to curate. It treats imported writing as untrusted data and keeps autobiography claims tied to source essays.

## Why there is no vector database

Personal essay collections are usually small enough for in-process lexical search. Markdown plus weighted metadata is inspectable, dependency-light, and easy to back up. A future embedding index can remain derived data if larger vaults prove it necessary.

## Why there is no direct Notion sync

Export-based ingestion needs no Notion integration secret, works offline, gives the user a stable snapshot, and avoids silent remote mutations. Continuous sync is intentionally outside version 1.0.
