import { describe, expect, it } from 'vitest';
import { assertJavaScriptBundleBudget } from '../scripts/release-budgets.js';

describe('JavaScript release budget', () => {
  it('accepts a representative production bundle within both raw and gzip limits', () => {
    expect(() => assertJavaScriptBundleBudget([
      { file: 'assets/index.js', rawBytes: 218_596, gzipBytes: 69_389 },
      { file: 'assets/FloorViewer.js', rawBytes: 305_402, gzipBytes: 94_547 },
      { file: 'assets/three.js', rawBytes: 718_125, gzipBytes: 185_580 },
    ])).not.toThrow();
  });

  it('rejects a chunk that exceeds the raw limit while its gzip size remains within budget', () => {
    expect(() => assertJavaScriptBundleBudget([
      { file: 'assets/raw-over-budget.js', rawBytes: 1_000_001, gzipBytes: 250_000 },
    ])).toThrow('assets/raw-over-budget.js: raw 1000001 B (budget 1000000 B)');
  });

  it('rejects a chunk that exceeds the gzip limit while its raw size remains within budget', () => {
    expect(() => assertJavaScriptBundleBudget([
      { file: 'assets/gzip-over-budget.js', rawBytes: 1_000_000, gzipBytes: 250_001 },
    ])).toThrow('assets/gzip-over-budget.js: raw 1000000 B (budget 1000000 B); gzip 250001 B (budget 250000 B)');
  });
});
