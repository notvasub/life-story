import { existsSync } from "node:fs";
import { join } from "node:path";
import { listDocuments } from "./document.js";

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateVault(vaultRoot: string): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const collection of ["essays", "stories", "use-cases"] as const) {
    if (!existsSync(join(vaultRoot, collection)))
      errors.push(`Missing ${collection}/ directory.`);
  }
  if (errors.length > 0) return { valid: false, errors, warnings };

  const essays = listDocuments(vaultRoot, "essays");
  const stories = listDocuments(vaultRoot, "stories");
  const essayIds = new Set(essays.map((essay) => essay.id));
  const storyIds = new Set(stories.map((story) => story.id));

  for (const document of [...essays, ...stories]) {
    if (!document.frontmatter.id) errors.push(`${document.path}: missing id.`);
    if (!document.frontmatter.title)
      errors.push(`${document.path}: missing title.`);
    if (document.body.trim().length === 0)
      errors.push(`${document.path}: empty body.`);
  }
  for (const story of stories) {
    const sources = Array.isArray(story.frontmatter.source_essays)
      ? story.frontmatter.source_essays.map(String)
      : [];
    if (sources.length === 0) warnings.push(`${story.id}: no source essays.`);
    for (const source of sources) {
      if (!essayIds.has(source))
        errors.push(`${story.id}: missing source essay ${source}.`);
    }
    const related = Array.isArray(story.frontmatter.related_stories)
      ? story.frontmatter.related_stories.map(String)
      : [];
    for (const id of related) {
      if (!storyIds.has(id))
        warnings.push(`${story.id}: related story ${id} does not exist yet.`);
    }
  }
  if (essays.length === 0)
    warnings.push(
      "The vault contains no essays. Import a Notion export first.",
    );
  if (stories.length === 0)
    warnings.push(
      "The vault contains no curated stories. Ask your AI client to curate it.",
    );
  return { valid: errors.length === 0, errors, warnings };
}
