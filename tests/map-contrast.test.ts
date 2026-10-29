import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SPACE_PRESENTATION_STYLES } from '../src/map/spacePresentation';
import { contrastRatio, relativeLuminance } from '../src/utils/colorContrast';

describe('map and control contrast evidence', () => {
  it('keeps application, search input, and legend marker text above WCAG AA contrast using application CSS', () => {
    const style = document.createElement('style');
    style.textContent = readFileSync('src/app/App.css', 'utf8');
    const fixture = document.createElement('div');
    fixture.innerHTML = '<div class="place-search"><input aria-label="Search place" /></div><i class="legend-swatch legend-swatch-marker">WC</i>';
    document.head.append(style);
    document.body.append(fixture);

    const hexColor = (color: string): `#${string}` => {
      const channels = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(color);
      if (!channels) throw new Error(`Expected an opaque RGB color, received ${color}`);
      return `#${channels.slice(1).map((channel) => Number(channel).toString(16).padStart(2, '0')).join('')}`;
    };

    try {
      for (const element of [document.documentElement, ...fixture.querySelectorAll('input, i')]) {
        const computed = getComputedStyle(element);
        expect(contrastRatio(hexColor(computed.color), hexColor(computed.backgroundColor)), element.tagName).toBeGreaterThanOrEqual(4.5);
      }
    } finally {
      fixture.remove();
      style.remove();
    }
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
