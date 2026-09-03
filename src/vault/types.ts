export const COLLECTIONS = ["stories", "essays", "use-cases"] as const;
export type VaultCollection = (typeof COLLECTIONS)[number];

export interface SourceDocument {
  sourcePath: string;
  title: string;
  body: string;
  format: "markdown" | "text" | "html" | "csv";
}

export interface EssayRecord extends SourceDocument {
  id: string;
  kind: "essay" | "application" | "notes" | "source-page";
  status: "final" | "draft" | "ideas" | "unknown";
  wordCount: number;
  stories: string[];
}

export interface StoryInput {
  id?: string;
  title: string;
  summary: string;
  details?: string;
  primaryThemes?: string[];
  secondaryThemes?: string[];
  bestFor?: string[];
  avoidFor?: string[];
  emotionalTone?: string[];
  sourceEssays?: string[];
  relatedStories?: string[];
  status?: "candidate" | "ready" | "archived";
}

export interface VaultDocument {
  id: string;
  path: string;
  frontmatter: Record<string, unknown>;
  body: string;
  markdown: string;
}

export interface SearchOptions {
  vaultRoot: string;
  collection: VaultCollection;
  query: string;
  filters?: Record<string, string[]>;
  limit?: number;
  contextLines?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  score: number;
  matchedFields: string[];
  snippets: string[];
}
