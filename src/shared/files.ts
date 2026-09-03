import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export function ensureDirectory(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function resolveUserPath(path: string, base = process.cwd()): string {
  return isAbsolute(path) ? resolve(path) : resolve(base, path);
}

export function assertInsideRoot(root: string, candidate: string): string {
  const rootPath = resolve(root);
  const candidatePath = resolve(candidate);
  const rel = relative(rootPath, candidatePath);
  if (
    rel === "" ||
    (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))
  ) {
    return candidatePath;
  }
  throw new Error(`Path escapes configured vault root: ${candidate}`);
}

export function assertSafeId(id: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,127}$/.test(id)) {
    throw new Error(`Invalid document id: ${id}`);
  }
  return id;
}

export function resolveExistingInsideRoot(
  root: string,
  candidate: string,
): string {
  const existingRoot = realpathSync(root);
  // realpath also normalizes macOS' /var -> /private/var alias. Containment is
  // checked after resolution so symlinks cannot point outside the vault.
  const existingCandidate = realpathSync(candidate);
  return assertInsideRoot(existingRoot, existingCandidate);
}

export function listMarkdownFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const base = resolveExistingInsideRoot(root, root);
  const files: string[] = [];

  function walk(directory: string): void {
    if (lstatSync(directory).isSymbolicLink()) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(resolveExistingInsideRoot(base, path));
      }
    }
  }

  walk(base);
  return files.sort();
}

export function ensureParent(path: string): void {
  ensureDirectory(dirname(path));
}
