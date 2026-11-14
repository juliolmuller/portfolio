import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const TEXT_FILE = /\.(?:ts|tsx|js|mjs|json|md|css|ya?ml|txt)$/u;
// Accents are written as escapes so this file never matches itself.
const ACCENTED = /r(?:é|é)sum(?:é|é)/iu;

describe('spelling', () => {
  it('writes "resume" without accents outside docs/archive', () => {
    const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter((file) => file && TEXT_FILE.test(file) && !file.startsWith('docs/archive/'));
    const hits: string[] = [];

    for (const file of files) {
      const lines = readFileSync(path.join(ROOT, file), 'utf8').split('\n');

      lines.forEach((line, index) => {
        if (ACCENTED.test(line)) {
          hits.push(`${file}:${index + 1}`);
        }
      });
    }

    expect(hits).toEqual([]);
  });
});
