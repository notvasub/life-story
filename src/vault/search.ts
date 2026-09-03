import { listDocuments } from "./document.js";
import type { SearchOptions, SearchResult } from "./types.js";

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "but",
  "can",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "into",
  "not",
  "our",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "you",
  "your",
]);

export function tokenize(input: string): string[] {
  return [
    ...new Set(
      input
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map((word) => word.replace(/(?:ing|ed|es|s)$/i, ""))
        .filter((word) => word.length >= 3 && !STOP_WORDS.has(word)),
    ),
  ];
}

function fieldContains(value: unknown, needles: string[]): boolean {
  const text = (
    Array.isArray(value) ? value.join(" ") : String(value ?? "")
  ).toLowerCase();
  return needles.some((needle) => text.includes(needle.toLowerCase()));
}

function snippets(
  body: string,
  terms: string[],
  contextLines: number,
): string[] {
  if (contextLines === 0 || terms.length === 0) return [];
  const lines = body.split(/\r?\n/);
  const found: string[] = [];
  lines.forEach((line, index) => {
    const normalized = line.toLowerCase();
    if (!terms.some((term) => normalized.includes(term))) return;
    const start = Math.max(0, index - contextLines);
    const end = Math.min(lines.length, index + contextLines + 1);
    const excerpt = lines.slice(start, end).join("\n").trim();
    if (excerpt && !found.includes(excerpt)) found.push(excerpt);
  });
  return found.slice(0, 3);
}

export function searchVault(options: SearchOptions): SearchResult[] {
  const query = options.query.trim().toLowerCase();
  const terms = tokenize(query);
  const filters = options.filters ?? {};
  const hasFilters = Object.values(filters).some((values) => values.length > 0);

  return listDocuments(options.vaultRoot, options.collection)
    .map((document) => {
      const title = String(document.frontmatter.title ?? document.id);
      const titleText = title.toLowerCase();
      const metadataText = JSON.stringify(document.frontmatter).toLowerCase();
      const bodyText = document.body.toLowerCase();
      let score = query && titleText.includes(query) ? 8 : 0;
      for (const term of terms) {
        if (titleText.includes(term)) score += 5;
        if (metadataText.includes(term)) score += 3;
        if (bodyText.includes(term)) score += 1;
      }
      const matchedFields: string[] = [];
      for (const [field, values] of Object.entries(filters)) {
        if (
          values.length > 0 &&
          fieldContains(document.frontmatter[field], values)
        ) {
          score += 6;
          matchedFields.push(field);
        }
      }
      return {
        id: document.id,
        title,
        score,
        matchedFields,
        snippets: snippets(document.body, terms, options.contextLines ?? 2),
      };
    })
    .filter((result) => result.score > 0 || (!query && !hasFilters))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, options.limit ?? 8);
}
