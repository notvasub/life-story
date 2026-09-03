import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import {
  htmlToText,
  readSourceDocuments,
} from "../src/importer/readSources.js";

describe("Notion export importer", () => {
  it("reads supported documents recursively and removes Notion IDs from titles", () => {
    const documents = readSourceDocuments(
      join(import.meta.dirname, "fixtures/notion-export"),
    );
    expect(documents).toHaveLength(2);
    expect(documents.map((item) => item.title)).toEqual([
      "Community Garden Essay",
      "Sensor Project",
    ]);
    expect(documents[0].sourcePath).toContain("Applications/");
  });

  it("reads ZIP exports and ignores attachments and tiny files", () => {
    const root = mkdtempSync(join(tmpdir(), "story-vault-zip-"));
    const archive = zipSync({
      "Essays/Useful.md": strToU8(
        "# Useful\n\nThis is a long enough personal essay to import into the vault.",
      ),
      "Essays/Empty.txt": strToU8("tiny"),
      "Essays/photo.png": new Uint8Array([1, 2, 3]),
    });
    const path = join(root, "export.zip");
    writeFileSync(path, archive);
    expect(readSourceDocuments(path).map((item) => item.title)).toEqual([
      "Useful",
    ]);
  });

  it("extracts readable text from HTML exports", () => {
    expect(
      htmlToText("<style>x</style><h1>A &amp; B</h1><p>Hello<br>world</p>"),
    ).toBe("A & B\nHello\nworld");
  });

  it("fails clearly for a missing export", () => {
    expect(() =>
      readSourceDocuments("/definitely/missing/notion-export.zip"),
    ).toThrow(/not found/);
  });
});
