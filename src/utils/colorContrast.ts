function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: `#${string}`): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Expected a six-digit hex color, received ${hex}.`);
  const red = channel(Number.parseInt(hex.slice(1, 3), 16));
  const green = channel(Number.parseInt(hex.slice(3, 5), 16));
  const blue = channel(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: `#${string}`, second: `#${string}`): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
