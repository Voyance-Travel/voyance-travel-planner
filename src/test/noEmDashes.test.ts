/**
 * Feature test: Ensure no em dashes (—) appear in user-facing UI text.
 * 
 * Em dashes should be replaced with regular dashes, commas, periods,
 * or restructured sentences. Admin pages are excluded.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const EM_DASH = '\u2014'; // —

/** Directories / file patterns to skip (admin, tests, node_modules) */
const SKIP_DIRS = ['node_modules', 'dist', '.git', 'src/pages/admin'];
const SKIP_FILES = [/\.test\./, /\.spec\./, /setup\.ts$/];

function collectTsxFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(process.cwd(), fullPath);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.some(skip => relPath.includes(skip))) continue;
      collectTsxFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      if (SKIP_FILES.some(re => re.test(entry.name))) continue;
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Check if a line contains an em dash in rendered UI text (not a comment).
 * We skip lines that are purely code comments.
 */
function findEmDashesInRenderedText(filePath: string): { line: number; text: string }[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations: { line: number; text: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes(EM_DASH)) continue;

    const trimmed = line.trim();

    // Skip pure comment lines (// or * or /*)
    if (/^\s*(\/\/|\/\*|\*)/.test(trimmed)) continue;

    // Has an em dash in non-comment code (could be JSX text, string literal, etc.)
    violations.push({ line: i + 1, text: trimmed });
  }

  return violations;
}

describe('No em dashes in user-facing UI', () => {
  it('should not contain em dashes (—) in any .tsx component file', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const files = collectTsxFiles(srcDir);
    const allViolations: { file: string; line: number; text: string }[] = [];

    for (const file of files) {
      const relPath = path.relative(process.cwd(), file);
      const violations = findEmDashesInRenderedText(file);
      for (const v of violations) {
        allViolations.push({ file: relPath, ...v });
      }
    }

    if (allViolations.length > 0) {
      const report = allViolations
        .map(v => `  ${v.file}:${v.line}\n    ${v.text}`)
        .join('\n\n');
      expect.fail(
        `Found ${allViolations.length} em dash(es) in UI code:\n\n${report}\n\n` +
        'Replace — with regular dashes (-), commas, or restructure the sentence.'
      );
    }
  });
});
