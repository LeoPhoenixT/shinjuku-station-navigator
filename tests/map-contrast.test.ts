import { describe, expect, it } from 'vitest';
import { SPACE_PRESENTATION_STYLES } from '../src/map/spacePresentation';
import { contrastRatio, relativeLuminance } from '../src/utils/colorContrast';

describe('map and control contrast evidence', () => {
  it('keeps primary control and legend text above WCAG AA normal-text contrast', () => {
    expect(contrastRatio('#e5edf7', '#08111f')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#cbd5e1', '#050a15')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#7dd3fc', '#050a15')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#f8fafc', '#08111f')).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the two-tone route distinguishable against every semantic Space surface', () => {
    for (const { color, group } of SPACE_PRESENTATION_STYLES) {
      const strongestRouteContrast = Math.max(contrastRatio('#fb923c', color), contrastRatio('#020617', color));
      expect(strongestRouteContrast, group).toBeGreaterThanOrEqual(3);
    }
  });

  it('validates color input rather than silently measuring malformed values', () => {
    expect(() => relativeLuminance('#fff')).toThrow('six-digit hex color');
  });
});
