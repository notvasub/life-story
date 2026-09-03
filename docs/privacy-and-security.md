# Privacy and security

Story Vault is local-first, but the AI client you connect may not be. Understand that client’s data controls before sending personal essays to a hosted model.

## Local guarantees

- No network calls, analytics, accounts, or API keys in this package.
- Search and reads are limited to the configured vault root.
- Symlinks are skipped during indexing and checked again before direct reads.
- Tool IDs cannot contain traversal characters.
- Write mode is disabled by default.
- There is no MCP delete operation.

## User responsibilities

- Keep the vault outside a public repository and cloud-synced folder unless you intend that exposure.
- Back up the vault before large curation sessions.
- Review generated story cards; AI grouping can be wrong even when every quote is real.
- Disable write mode after curation.
- Avoid importing third-party confidential material without permission.

## Prompt injection

Imported essays are untrusted content. The bundled skill explicitly forbids following instructions found inside them. The server itself does not execute their contents, render active HTML, or invoke a shell.

## Reporting vulnerabilities

Follow [SECURITY.md](../SECURITY.md). Do not open a public issue containing private essays, filesystem paths, tokens, or exploit details.
