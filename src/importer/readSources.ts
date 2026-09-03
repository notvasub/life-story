import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { strFromU8, Unzip, UnzipInflate } from "fflate";
import type { SourceDocument } from "../vault/types.js";

const SUPPORTED_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".txt",
  ".html",
  ".htm",
  ".csv",
]);
const NOTION_ID_SUFFIX = /\s+[0-9a-f]{32}$/i;
const MAX_TEXT_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_TEXT_BYTES = 250 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 50_000;

function decodeEntities(value: string): string {
  const entities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (_match, entity: string) => {
      if (entity.startsWith("#x"))
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith("#"))
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      return entities[entity.toLowerCase()] ?? `&${entity};`;
    },
  );
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function titleFromPath(path: string, body: string): string {
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading.replace(NOTION_ID_SUFFIX, "");
  return (
    basename(path, extname(path)).replace(NOTION_ID_SUFFIX, "").trim() ||
    "Untitled"
  );
}

function toDocument(
  sourcePath: string,
  content: string,
): SourceDocument | null {
  const extension = extname(sourcePath).toLowerCase();
  if (
    !SUPPORTED_EXTENSIONS.has(extension) ||
    sourcePath.split("/").some((part) => part.startsWith("."))
  ) {
    return null;
  }
  const format =
    extension === ".html" || extension === ".htm"
      ? "html"
      : extension === ".csv"
        ? "csv"
        : extension === ".txt"
          ? "text"
          : "markdown";
  const body =
    format === "html"
      ? htmlToText(content)
      : content.replace(/^\uFEFF/, "").trim();
  if (body.replace(/\s/g, "").length < 20) return null;
  return { sourcePath, title: titleFromPath(sourcePath, body), body, format };
}

function readDirectory(root: string): SourceDocument[] {
  const documents: SourceDocument[] = [];
  function walk(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) {
        const document = toDocument(
          relative(root, path).replaceAll("\\", "/"),
          readFileSync(path, "utf8"),
        );
        if (document) documents.push(document);
      }
    }
  }
  walk(root);
  return documents.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
}

function readZip(path: string): SourceDocument[] {
  const documents: SourceDocument[] = [];
  let entries = 0;
  let totalBytes = 0;
  const unzipper = new Unzip((file) => {
    entries += 1;
    if (entries > MAX_ARCHIVE_ENTRIES) {
      throw new Error(`ZIP contains more than ${MAX_ARCHIVE_ENTRIES} entries.`);
    }
    const extension = extname(file.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) return;
    if (
      file.originalSize !== undefined &&
      file.originalSize > MAX_TEXT_FILE_BYTES
    ) {
      throw new Error(`ZIP text entry is too large: ${file.name}`);
    }
    const chunks: Uint8Array[] = [];
    let fileBytes = 0;
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      fileBytes += chunk.length;
      totalBytes += chunk.length;
      if (
        fileBytes > MAX_TEXT_FILE_BYTES ||
        totalBytes > MAX_TOTAL_TEXT_BYTES
      ) {
        file.terminate();
        throw new Error("ZIP exceeds the safe text extraction limit.");
      }
      chunks.push(chunk);
      if (final) {
        const content = new Uint8Array(fileBytes);
        let offset = 0;
        for (const part of chunks) {
          content.set(part, offset);
          offset += part.length;
        }
        const document = toDocument(file.name, strFromU8(content));
        if (document) documents.push(document);
      }
    };
    file.start();
  });
  unzipper.register(UnzipInflate);
  unzipper.push(new Uint8Array(readFileSync(path)), true);
  return documents.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
}

export function readSourceDocuments(inputPath: string): SourceDocument[] {
  if (!existsSync(inputPath))
    throw new Error(`Notion export not found: ${inputPath}`);
  const stats = statSync(inputPath);
  if (stats.isDirectory()) return readDirectory(inputPath);
  if (stats.isFile() && extname(inputPath).toLowerCase() === ".zip")
    return readZip(inputPath);
  if (stats.isFile()) {
    const document = toDocument(
      basename(inputPath),
      readFileSync(inputPath, "utf8"),
    );
    return document ? [document] : [];
  }
  throw new Error(`Unsupported input: ${inputPath}`);
}
