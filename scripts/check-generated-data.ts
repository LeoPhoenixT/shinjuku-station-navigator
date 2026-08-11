import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildAllData, GENERATED_FILES } from './build-all-data.js';
import { isMainModule } from './data/is-main-module.js';

export function normalizeGeneratedText(value: string): string {
  return value.replaceAll('\r\n', '\n');
}

export function checkGeneratedData(): void {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'shinjuku-data-check-'));
  try {
    buildAllData(temporaryRoot);
    const stale = GENERATED_FILES.filter((file) => normalizeGeneratedText(readFileSync(file, 'utf8')) !== normalizeGeneratedText(readFileSync(path.join(temporaryRoot, file), 'utf8')));
    if (stale.length > 0) throw new Error(`Generated data is stale or nondeterministic:\n${stale.map((file) => `- ${file}`).join('\n')}`);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

if (isMainModule(import.meta.url)) {
  checkGeneratedData();
  console.log(`Verified ${GENERATED_FILES.length} committed generated artifacts.`);
}
