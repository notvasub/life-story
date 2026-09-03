import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSourceDocuments } from "../src/importer/readSources.js";
import { getDocument } from "../src/vault/document.js";
import {
  importDocuments,
  initializeVault,
  upsertStory,
  vaultStats,
} from "../src/vault/manage.js";
import { validateVault } from "../src/vault/validate.js";

function populatedVault(): { root: string; essayIds: string[] } {
  const root = mkdtempSync(join(tmpdir(), "story-vault-"));
  const documents = readSourceDocuments(
    join(import.meta.dirname, "fixtures/notion-export"),
  );
  importDocuments(documents, root);
  const index = JSON.parse(
    readFileSync(join(root, "00-index/essays.json"), "utf8"),
  ) as Array<{ id: string }>;
  return { root, essayIds: index.map((item) => item.id) };
}

describe("vault management", () => {
  it("initializes an empty Obsidian-compatible vault", () => {
    const root = mkdtempSync(join(tmpdir(), "story-vault-init-"));
    initializeVault(root);
    expect(vaultStats(root)).toMatchObject({
      essays: 0,
      stories: 0,
      useCases: 0,
    });
    expect(readFileSync(join(root, "00-index/story-map.md"), "utf8")).toContain(
      "No stories",
    );
  });

  it("imports deterministically without destroying story backlinks", () => {
    const { root, essayIds } = populatedVault();
    upsertStory(root, {
      title: "Learning to listen in the garden",
      summary:
        "A volunteer improved the watering plan after the organizer learned to listen.",
      sourceEssays: [essayIds[0]],
      primaryThemes: ["leadership"],
    });
    const second = importDocuments(
      readSourceDocuments(join(import.meta.dirname, "fixtures/notion-export")),
      root,
    );
    expect(second).toMatchObject({ imported: 0, skipped: 2 });
    expect(
      getDocument(root, "essays", essayIds[0]).frontmatter.stories,
    ).toContain("learning-to-listen-in-the-garden");
  });

  it("creates reciprocal Obsidian links and validates references", () => {
    const { root, essayIds } = populatedVault();
    const id = upsertStory(root, {
      title: "Garden sensor debugging",
      summary: "Temperature logging revealed why moisture readings drifted.",
      details: "The sensor was recalibrated and used during a hot week.",
      primaryThemes: ["technical problem solving"],
      bestFor: ["engineering application"],
      sourceEssays: [essayIds[1]],
      status: "ready",
    });
    const story = getDocument(root, "stories", id);
    expect(story.body).toContain(`[[${essayIds[1]}]]`);
    expect(
      getDocument(root, "essays", essayIds[1]).frontmatter.stories,
    ).toContain(id);
    expect(validateVault(root)).toMatchObject({ valid: true, errors: [] });
  });

  it("refuses links to nonexistent essays", () => {
    const { root } = populatedVault();
    expect(() =>
      upsertStory(root, {
        title: "Unsupported",
        summary: "No evidence",
        sourceEssays: ["missing"],
      }),
    ).toThrow(/not found/);
  });
});
