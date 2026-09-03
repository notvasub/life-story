import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { ensureDirectory } from "../shared/files.js";
import {
  parseMarkdownWithFrontmatter,
  serializeMarkdownWithFrontmatter,
} from "../shared/frontmatter.js";
import { slugify, stableDocumentId } from "../shared/slug.js";
import type { EssayRecord, SourceDocument, StoryInput } from "./types.js";
import { getDocument, listDocuments } from "./document.js";

export interface ImportResult {
  imported: number;
  skipped: number;
  vaultRoot: string;
}

function classify(
  source: SourceDocument,
): Pick<EssayRecord, "kind" | "status"> {
  const value = `${source.sourcePath} ${source.title}`.toLowerCase();
  const status = value.includes("final")
    ? "final"
    : value.includes("draft")
      ? "draft"
      : value.includes("idea")
        ? "ideas"
        : "unknown";
  const kind = value.includes("application")
    ? "application"
    : /essay|supplement|personal statement|draft|final/.test(value)
      ? "essay"
      : /note|research|brainstorm/.test(value)
        ? "notes"
        : "source-page";
  return { kind, status };
}

export function initializeVault(vaultRoot: string): void {
  for (const directory of ["00-index", "essays", "stories", "use-cases"]) {
    ensureDirectory(join(vaultRoot, directory));
  }
  const readme = join(vaultRoot, "README.md");
  if (!existsSync(readme)) {
    writeFileSync(
      readme,
      "# My Story Vault\n\nOpen this directory as an Obsidian vault if you want a visual graph. Keep it private: it contains personal writing.\n",
    );
  }
  writeIndexes(vaultRoot);
}

export function importDocuments(
  documents: SourceDocument[],
  vaultRoot: string,
): ImportResult {
  initializeVault(vaultRoot);
  let imported = 0;
  let skipped = 0;
  for (const source of documents) {
    const id = stableDocumentId(source.title, source.sourcePath);
    const output = join(vaultRoot, "essays", `${id}.md`);
    const existing = existsSync(output)
      ? parseMarkdownWithFrontmatter(readFileSync(output, "utf8")).frontmatter
      : {};
    const record: EssayRecord = {
      ...source,
      id,
      ...classify(source),
      wordCount: source.body.split(/\s+/).filter(Boolean).length,
      stories: Array.isArray(existing.stories)
        ? existing.stories.map(String)
        : [],
    };
    const markdown = serializeMarkdownWithFrontmatter(
      {
        format: record.format,
        id: record.id,
        kind: record.kind,
        source_path: record.sourcePath,
        status: record.status,
        stories: record.stories,
        title: record.title,
        type: "essay",
        word_count: record.wordCount,
      },
      `# ${record.title}\n\n${record.body}`,
    );
    if (existsSync(output) && readFileSync(output, "utf8") === markdown)
      skipped += 1;
    else {
      writeFileSync(output, markdown);
      imported += 1;
    }
  }
  writeIndexes(vaultRoot);
  return { imported, skipped, vaultRoot };
}

function unique(values: string[] | undefined): string[] {
  return [
    ...new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  ].sort();
}

export function upsertStory(vaultRoot: string, input: StoryInput): string {
  initializeVault(vaultRoot);
  const id = input.id ? slugify(input.id) : slugify(input.title);
  if (!id)
    throw new Error("Story title must contain at least one letter or number.");
  const sourceEssays = unique(input.sourceEssays);
  for (const essayId of sourceEssays) getDocument(vaultRoot, "essays", essayId);
  const relatedStories = unique(input.relatedStories).filter(
    (related) => related !== id,
  );
  const storyPath = join(vaultRoot, "stories", `${id}.md`);
  const sourceLinks = sourceEssays.length
    ? sourceEssays.map((essayId) => `- [[${essayId}]]`).join("\n")
    : "- _No source essays linked yet._";
  const relatedLinks = relatedStories.length
    ? relatedStories.map((storyId) => `- [[${storyId}]]`).join("\n")
    : "- _No related stories yet._";
  writeFileSync(
    storyPath,
    serializeMarkdownWithFrontmatter(
      {
        avoid_for: unique(input.avoidFor),
        best_for: unique(input.bestFor),
        emotional_tone: unique(input.emotionalTone),
        id,
        primary_themes: unique(input.primaryThemes),
        related_stories: relatedStories,
        secondary_themes: unique(input.secondaryThemes),
        source_essays: sourceEssays,
        status: input.status ?? "candidate",
        title: input.title.trim(),
        type: "story",
      },
      `# ${input.title.trim()}\n\n## Core Story\n\n${input.summary.trim()}\n\n${input.details?.trim() ? `## Detailed Version\n\n${input.details.trim()}\n\n` : ""}## Source Essays\n\n${sourceLinks}\n\n## Related Stories\n\n${relatedLinks}`,
    ),
  );

  for (const essayId of sourceEssays) {
    const essay = getDocument(vaultRoot, "essays", essayId);
    const stories = unique([
      ...(Array.isArray(essay.frontmatter.stories)
        ? essay.frontmatter.stories.map(String)
        : []),
      id,
    ]);
    writeFileSync(
      essay.path,
      serializeMarkdownWithFrontmatter(
        { ...essay.frontmatter, stories },
        essay.body,
      ),
    );
  }
  writeIndexes(vaultRoot);
  return id;
}

export function writeIndexes(vaultRoot: string): void {
  ensureDirectory(join(vaultRoot, "00-index"));
  const stories = existsSync(join(vaultRoot, "stories"))
    ? listDocuments(vaultRoot, "stories")
    : [];
  const essays = existsSync(join(vaultRoot, "essays"))
    ? listDocuments(vaultRoot, "essays")
    : [];
  const compact = (document: ReturnType<typeof listDocuments>[number]) => ({
    id: document.id,
    ...document.frontmatter,
    path: relative(vaultRoot, document.path).replaceAll("\\", "/"),
  });
  writeFileSync(
    join(vaultRoot, "00-index", "stories.json"),
    `${JSON.stringify(stories.map(compact), null, 2)}\n`,
  );
  writeFileSync(
    join(vaultRoot, "00-index", "essays.json"),
    `${JSON.stringify(essays.map(compact), null, 2)}\n`,
  );
  writeFileSync(
    join(vaultRoot, "00-index", "story-map.md"),
    `# Story Map\n\n${stories.map((story) => `- [[${story.id}]] — ${String(story.frontmatter.title ?? story.id)}`).join("\n") || "_No stories curated yet._"}\n`,
  );
}

export function installSkill(
  sourceDirectory: string,
  targetDirectory: string,
  force = false,
): string {
  const source = join(sourceDirectory, "SKILL.md");
  if (!existsSync(source))
    throw new Error(`Bundled skill not found: ${source}`);
  if (existsSync(targetDirectory) && !force) {
    throw new Error(
      `Skill already exists: ${targetDirectory}. Re-run with --force to replace it.`,
    );
  }
  ensureDirectory(dirname(targetDirectory));
  const temporary = `${targetDirectory}.tmp-${process.pid}`;
  rmSync(temporary, { recursive: true, force: true });
  ensureDirectory(temporary);
  for (const file of ["SKILL.md"])
    writeFileSync(
      join(temporary, file),
      readFileSync(join(sourceDirectory, file)),
    );
  const agents = join(sourceDirectory, "agents", "openai.yaml");
  if (existsSync(agents)) {
    ensureDirectory(join(temporary, "agents"));
    writeFileSync(
      join(temporary, "agents", "openai.yaml"),
      readFileSync(agents),
    );
  }
  rmSync(targetDirectory, { recursive: true, force: true });
  renameSync(temporary, targetDirectory);
  return targetDirectory;
}

export function vaultStats(vaultRoot: string): Record<string, number | string> {
  return {
    vaultRoot,
    essays: listDocuments(vaultRoot, "essays").length,
    stories: listDocuments(vaultRoot, "stories").length,
    useCases: listDocuments(vaultRoot, "use-cases").length,
  };
}
