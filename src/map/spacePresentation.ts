import { resolveIndoorMapCategory, type IndoorMapVisualGroup } from '../data/indoorMapCategories.js';
import type { ProcessedFeature } from '../types/processed.js';

export interface SpacePresentationStyle {
  group: IndoorMapVisualGroup;
  color: `#${string}`;
  height: number;
  offset: number;
  opacity: number;
  emphasis: 'none' | 'vertical' | 'restricted';
}

const style = (group: IndoorMapVisualGroup, color: `#${string}`, height: number, opacity: number, emphasis: SpacePresentationStyle['emphasis'] = 'none'): SpacePresentationStyle => ({
  group, color, height, offset: 0.3, opacity, emphasis,
});

export const SPACE_PRESENTATION_STYLES: readonly SpacePresentationStyle[] = [
  style('walkway', '#244b68', 0.12, 0.9),
  style('room', '#334155', 0.18, 0.92),
  style('retail', '#475569', 0.2, 0.94),
  style('office', '#374151', 0.2, 0.92),
  style('waiting', '#4d5f27', 0.18, 0.94),
  style('ticket', '#854d0e', 0.24, 0.96),
  style('information', '#155e75', 0.24, 0.96),
  style('toilet', '#0f766e', 0.24, 0.96),
  style('multipurpose-toilet', '#0d9488', 0.3, 0.98),
  style('stairs', '#6d4ac7', 0.28, 0.98, 'vertical'),
  style('elevator', '#2563eb', 0.36, 0.98, 'vertical'),
  style('escalator', '#9333aa', 0.3, 0.98, 'vertical'),
  style('moving-walkway', '#0891b2', 0.22, 0.96, 'vertical'),
  style('slope', '#0284c7', 0.22, 0.96, 'vertical'),
  style('platform', '#92400e', 0.16, 0.94),
  style('restricted', '#4c1d3d', 0.22, 0.9, 'restricted'),
  style('outdoor', '#3b2b5b', 0.1, 0.78),
  style('barrier', '#3f3f46', 0.2, 0.88),
  style('unknown', '#263244', 0.12, 0.82),
] as const;

const styleByGroup = new Map(SPACE_PRESENTATION_STYLES.map((entry) => [entry.group, entry]));
const unknownStyle = styleByGroup.get('unknown')!;

export function spacePresentationStyle(category: unknown): SpacePresentationStyle {
  const group = resolveIndoorMapCategory('Space', category).visual.group;
  return styleByGroup.get(group) ?? unknownStyle;
}

export function groupSpaceFeatures(features: ProcessedFeature[]): Map<SpacePresentationStyle, ProcessedFeature[]> {
  const grouped = new Map<SpacePresentationStyle, ProcessedFeature[]>();
  for (const feature of features) {
    if (feature.layer !== 'Space') continue;
    const presentation = spacePresentationStyle(feature.properties.category);
    const group = grouped.get(presentation) ?? [];
    group.push(feature);
    grouped.set(presentation, group);
  }
  return grouped;
}
