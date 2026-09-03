import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSourceDocuments } from "../src/importer/readSources.js";
import { getDocument } from "../src/vault/document.js";
import { importDocuments, upsertStory } from "../src/vault/manage.js";
import { searchVault, tokenize } from "../src/vault/search.js";

describe("vault search", () => {
  it("ranks title, metadata, and body matches and returns snippets", () => {
    const root = mkdtempSync(join(tmpdir(), "story-search-"));
    const documents = readSourceDocuments(
      join(import.meta.dirname, "fixtures/notion-export"),
    );
    importDocuments(documents, root);
    const essay = searchVault({
      vaultRoot: root,
      collection: "essays",
      query: "soil moisture sensor",
      limit: 1,
    });
    expect(essay[0].title).toBe("Sensor Project");
    expect(essay[0].snippets.join(" ")).toContain("soil-moisture sensor");
    upsertStory(root, {
      title: "Listening in the garden",
      summary: "A leadership lesson from listening to a younger volunteer.",
      primaryThemes: ["leadership"],
      sourceEssays: [essay[0].id],
    });
    const filtered = searchVault({
      vaultRoot: root,
      collection: "stories",
      query: "",
      filters: { primary_themes: ["leadership"] },
    });
    expect(filtered.map((item) => item.id)).toEqual([
      "listening-in-the-garden",
    ]);
  });

  it("normalizes repeated and common query terms", () => {
    expect(tokenize("The builders were building sensor sensors")).toEqual([
      "builder",
      "build",
      "sensor",
    ]);
  });

  it("blocks traversal IDs and symlink reads", () => {
    const root = mkdtempSync(join(tmpdir(), "story-safe-"));
    importDocuments(
      readSourceDocuments(join(import.meta.dirname, "fixtures/notion-export")),
      root,
    );
    expect(() => getDocument(root, "essays", "../secret")).toThrow(
      /Invalid document id/,
    );
    const outside = join(tmpdir(), `outside-${process.pid}.md`);
    writeFileSync(outside, "secret");
    symlinkSync(outside, join(root, "essays", "escape.md"));
    expect(() => getDocument(root, "essays", "escape")).toThrow(/escapes/);
  });
});
