import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Reads a committed HTML fixture file's raw text. Test-only: never used by shipped code. */
export function loadFixtureHtml(fixtureDir: string, fileName: string): string {
  return readFileSync(join(fixtureDir, fileName), 'utf-8');
}

/** Replaces the jsdom document's content with a fixture's markup. */
export function renderFixture(html: string): void {
  document.documentElement.innerHTML = html;
}
