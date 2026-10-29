import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyDeployment } from '../scripts/verify-deployment.js';
import { renderStaticSeoPage } from '../src/seo/staticPage.js';

let root: string;
let report: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'verify-deployment-'));
  report = path.join(root, 'release-status.md');
  cpSync('public', root, { recursive: true });
  mkdirSync(path.join(root, 'ja'), { recursive: true });
  mkdirSync(path.join(root, 'assets'));
  const assets = '<script type="module" src="./assets/index.js"></script>';
  writeFileSync(path.join(root, 'assets/index.js'), 'console.log("release fixture");');
  writeFileSync(path.join(root, 'index.html'), renderStaticSeoPage('en', assets));
  writeFileSync(path.join(root, 'ja/index.html'), renderStaticSeoPage('ja', assets));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('deployment verification', () => {
  it('validates and reports the deployed artifact', () => {
    expect(() => verifyDeployment(root, report)).not.toThrow();
    expect(readFileSync(report, 'utf8')).toContain('Raw GIS files in the release: none.');
  });

  it.each([
    'jr-shinjuku-ticket-gates-b1-official-network.json',
    'shinjuku-b1-named-places.json',
    'shinjuku-full-map.json',
    'shinjuku-reviewed-custom-network.json',
    'shinjuku-place-translations.json',
  ])('rejects invalid deployed %s even when the source remains valid', (file) => {
    const sourcePath = path.join('public/data/processed', file);
    const source = readFileSync(sourcePath, 'utf8');
    const invalid = JSON.parse(source) as Record<string, unknown>;
    invalid.schemaVersion = 999;
    writeFileSync(path.join(root, 'data/processed', file), JSON.stringify(invalid));

    expect(() => verifyDeployment(root, report)).toThrow(/schemaVersion/);
    expect(readFileSync(sourcePath, 'utf8')).toBe(source);
    expect(existsSync(report)).toBe(false);
  });
});
