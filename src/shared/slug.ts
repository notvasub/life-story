import { createHash } from "node:crypto";

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function stableDocumentId(title: string, sourcePath: string): string {
  const base = slugify(title) || "untitled";
  const digest = createHash("sha256")
    .update(sourcePath)
    .digest("hex")
    .slice(0, 8);
  return `${base}-${digest}`;
}
