export type StructuralLineLayer = 'opening' | 'drawing' | 'outdoor';
export type StructuralLineState = 'active' | 'context';

export interface StructuralLineStyle {
  layer: StructuralLineLayer;
  state: StructuralLineState;
  color: `#${string}`;
  lineWidth: number;
  opacity: number;
  xrayOpacity: number;
  yOffset: number;
  renderOrder: number;
}

const style = (layer: StructuralLineLayer, state: StructuralLineState, color: `#${string}`, lineWidth: number, opacity: number, xrayOpacity: number, yOffset: number, renderOrder: number): StructuralLineStyle => ({
  layer, state, color, lineWidth, opacity, xrayOpacity, yOffset, renderOrder,
});

export const STRUCTURAL_LINE_STYLES = {
  drawingContext: style('drawing', 'context', '#94a3b8', 0.8, 0.16, 0.025, 3.55, 1600),
  outdoorContext: style('outdoor', 'context', '#a78bfa', 1.15, 0.24, 0.035, 0.78, 1700),
  openingContext: style('opening', 'context', '#db2777', 1.35, 0.3, 0.06, 0.72, 1800),
  drawingActive: style('drawing', 'active', '#94a3b8', 1, 0.44, 0.05, 3.55, 2200),
  outdoorActive: style('outdoor', 'active', '#c084fc', 1.55, 0.76, 0.09, 0.78, 2300),
  openingActive: style('opening', 'active', '#f472b6', 2.2, 0.96, 0.16, 0.72, 2400),
} as const satisfies Record<string, StructuralLineStyle>;

export const STRUCTURAL_LINE_RENDER_SEQUENCE: readonly StructuralLineStyle[] = [
  STRUCTURAL_LINE_STYLES.drawingContext,
  STRUCTURAL_LINE_STYLES.outdoorContext,
  STRUCTURAL_LINE_STYLES.openingContext,
  STRUCTURAL_LINE_STYLES.drawingActive,
  STRUCTURAL_LINE_STYLES.outdoorActive,
  STRUCTURAL_LINE_STYLES.openingActive,
];
