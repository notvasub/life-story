import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMarkdownWithFrontmatter } from "../shared/frontmatter.js";
import {
  assertInsideRoot,
  assertSafeId,
  listMarkdownFiles,
  resolveExistingInsideRoot,
} from "../shared/files.js";
import type { VaultCollection, VaultDocument } from "./types.js";

export function listDocuments(
  vaultRoot: string,
  collection: VaultCollection,
): VaultDocument[] {
  const root = assertInsideRoot(vaultRoot, join(vaultRoot, collection));
  return listMarkdownFiles(root).map((path) =>
    readDocumentPath(vaultRoot, path),
  );
}

export function readDocumentPath(
  vaultRoot: string,
  path: string,
): VaultDocument {
  const safePath = resolveExistingInsideRoot(vaultRoot, path);
  const markdown = readFileSync(safePath, "utf8");
  const parsed = parseMarkdownWithFrontmatter(markdown);
  const fallbackId = safePath.split(/[\\/]/).pop()?.replace(/\.md$/i, "") ?? "";
  return {
    id: String(parsed.frontmatter.id ?? fallbackId),
    path: safePath,
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    markdown,
  };
}

export function getDocument(
  vaultRoot: string,
  collection: VaultCollection,
  id: string,
): VaultDocument {
  const safeId = assertSafeId(id);
  const candidate = assertInsideRoot(
    vaultRoot,
    join(vaultRoot, collection, `${safeId}.md`),
  );
  if (!existsSync(candidate))
    throw new Error(`${collection.slice(0, -1)} not found: ${safeId}`);
  return readDocumentPath(vaultRoot, candidate);
}
