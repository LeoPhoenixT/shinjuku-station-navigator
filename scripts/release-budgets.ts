export interface JavaScriptBundleSize {
  file: string;
  rawBytes: number;
  gzipBytes: number;
}

export const JAVASCRIPT_BUNDLE_BUDGET = {
  // This is the pre-existing release limit for a single uncompressed JavaScript chunk.
  maxRawBytes: 1_000_000,
  // R7 keeps at least 25% growth room above the measured gzip baseline, rounded to 250 kB.
  maxGzipBytes: 250_000,
} as const;

export function formatJavaScriptBundleSize(bundle: JavaScriptBundleSize): string {
  return `${bundle.file}: raw ${(bundle.rawBytes / 1_000).toFixed(1)} kB; gzip ${(bundle.gzipBytes / 1_000).toFixed(1)} kB`;
}

export function assertJavaScriptBundleBudget(bundles: readonly JavaScriptBundleSize[]): void {
  if (bundles.length === 0) throw new Error('Release artifact contains no JavaScript bundles to measure.');

  const violations = bundles.flatMap((bundle) => {
    const overRaw = bundle.rawBytes > JAVASCRIPT_BUNDLE_BUDGET.maxRawBytes;
    const overGzip = bundle.gzipBytes > JAVASCRIPT_BUNDLE_BUDGET.maxGzipBytes;
    return overRaw || overGzip
      ? [`${bundle.file}: raw ${bundle.rawBytes} B (budget ${JAVASCRIPT_BUNDLE_BUDGET.maxRawBytes} B); gzip ${bundle.gzipBytes} B (budget ${JAVASCRIPT_BUNDLE_BUDGET.maxGzipBytes} B)`]
      : [];
  });

  if (violations.length > 0) throw new Error(`JavaScript bundle budget exceeded:\n${violations.join('\n')}`);
}
