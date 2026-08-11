import { describe, expect, it } from 'vitest';
import { STRUCTURAL_LINE_RENDER_SEQUENCE, STRUCTURAL_LINE_STYLES } from '../src/map/structuralLinePresentation';

describe('Opening, Drawing, and outdoor line presentation', () => {
  it('uses distinct theme-adapted colors with magenta Openings', () => {
    expect(STRUCTURAL_LINE_STYLES.openingActive.color).toBe('#f472b6');
    expect(STRUCTURAL_LINE_STYLES.drawingActive.color).toBe('#94a3b8');
    expect(STRUCTURAL_LINE_STYLES.outdoorActive.color).toBe('#c084fc');
    expect(new Set([STRUCTURAL_LINE_STYLES.openingActive.color, STRUCTURAL_LINE_STYLES.drawingActive.color, STRUCTURAL_LINE_STYLES.outdoorActive.color])).toHaveLength(3);
  });

  it('keeps active-floor lines stronger than context without making hidden floors visible', () => {
    expect(STRUCTURAL_LINE_STYLES.openingActive.opacity).toBeGreaterThan(STRUCTURAL_LINE_STYLES.openingContext.opacity);
    expect(STRUCTURAL_LINE_STYLES.drawingActive.opacity).toBeGreaterThan(STRUCTURAL_LINE_STYLES.drawingContext.opacity);
    expect(STRUCTURAL_LINE_STYLES.outdoorActive.opacity).toBeGreaterThan(STRUCTURAL_LINE_STYLES.outdoorContext.opacity);
  });

  it('has deterministic layer ordering and constant-pixel widths', () => {
    const orders = STRUCTURAL_LINE_RENDER_SEQUENCE.map(({ renderOrder }) => renderOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders)).toHaveLength(orders.length);
    expect(STRUCTURAL_LINE_RENDER_SEQUENCE.every(({ lineWidth, xrayOpacity }) => lineWidth > 0 && xrayOpacity > 0)).toBe(true);
    expect(STRUCTURAL_LINE_STYLES.openingActive.renderOrder).toBeGreaterThan(STRUCTURAL_LINE_STYLES.drawingActive.renderOrder);
  });
});
