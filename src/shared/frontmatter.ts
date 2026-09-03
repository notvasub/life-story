import { parse, stringify } from "yaml";

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

export function parseMarkdownWithFrontmatter(markdown: string): ParsedMarkdown {
  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n"))
    return { frontmatter: {}, body: normalized };

  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) return { frontmatter: {}, body: normalized };

  const value = parse(normalized.slice(4, end));
  return {
    frontmatter:
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {},
    body: normalized.slice(end + 5),
  };
}

export function serializeMarkdownWithFrontmatter(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const sorted = Object.fromEntries(
    Object.entries(frontmatter)
      .filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return `---\n${stringify(sorted, { lineWidth: 0 }).trim()}\n---\n\n${body.trim()}\n`;
}
