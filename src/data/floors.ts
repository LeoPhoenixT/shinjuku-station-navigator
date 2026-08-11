export function normalizeFloorId(raw: string): string {
  const value = raw.trim().toUpperCase();
  if (/^B\d+$/.test(value)) return value;
  if (/^-\d+$/.test(value)) return `B${Math.abs(Number(value))}`;
  if (/^\d+OUT$/.test(value)) return value.toLowerCase();
  if (/^\d+$/.test(value)) return value;
  return value;
}

export function floorElevationMeters(floorId: string): number {
  const normalized = normalizeFloorId(floorId);
  if (/^B\d+(?:\.\d+)?$/.test(normalized)) return -5 * Number(normalized.slice(1));
  if (/^\d+(?:\.\d+)?(?:OUT)?$/i.test(normalized)) return 5 * Number.parseFloat(normalized);
  return 0;
}
