import { resolveIndoorMapCategory } from '../data/indoorMapCategories.js';
import type { ProcessedFeature } from '../types/processed.js';

export type FixturePresentationGroup =
  | 'column'
  | 'wall'
  | 'ticket-gate'
  | 'platform-gate'
  | 'bench'
  | 'locker'
  | 'vending-machine'
  | 'atm'
  | 'furniture-low'
  | 'furniture-solid'
  | 'barrier-low'
  | 'barrier-solid'
  | 'barrier-thin'
  | 'fixture'
  | 'unknown';

export interface FixturePresentationStyle {
  group: FixturePresentationGroup;
  color: `#${string}`;
  outlineColor: `#${string}`;
  height: number;
  offset: number;
  opacity: number;
  priority: 'structure' | 'barrier' | 'context';
}

const style = (group: FixturePresentationGroup, color: `#${string}`, outlineColor: `#${string}`, height: number, opacity: number, priority: FixturePresentationStyle['priority']): FixturePresentationStyle => ({
  group, color, outlineColor, height, offset: 0.5, opacity, priority,
});

export const FIXTURE_PRESENTATION_STYLES: readonly FixturePresentationStyle[] = [
  style('column', '#9ca3af', '#f8fafc', 3.2, 1, 'structure'),
  style('wall', '#cbd5e1', '#ffffff', 3.4, 1, 'structure'),
  style('platform-gate', '#a855f7', '#f0abfc', 1.45, 0.96, 'barrier'),
  style('ticket-gate', '#d97706', '#fde68a', 1.05, 0.96, 'barrier'),
  style('barrier-thin', '#94a3b8', '#e2e8f0', 1.2, 0.94, 'barrier'),
  style('barrier-solid', '#787f8c', '#d1d5db', 1.35, 0.94, 'barrier'),
  style('barrier-low', '#806451', '#d6b898', 0.65, 0.88, 'barrier'),
  style('bench', '#786343', '#d6b98b', 0.55, 0.82, 'context'),
  style('locker', '#526176', '#cbd5e1', 1.8, 0.9, 'context'),
  style('vending-machine', '#0f766e', '#99f6e4', 1.9, 0.9, 'context'),
  style('atm', '#1d4ed8', '#bfdbfe', 1.4, 0.92, 'context'),
  style('furniture-low', '#665f57', '#c4b9ac', 0.65, 0.8, 'context'),
  style('furniture-solid', '#536174', '#b8c5d6', 1.6, 0.86, 'context'),
  style('fixture', '#475569', '#cbd5e1', 1.8, 0.88, 'context'),
  style('unknown', '#3f3f46', '#a1a1aa', 1.2, 0.76, 'context'),
] as const;

const styleByGroup = new Map(FIXTURE_PRESENTATION_STYLES.map((entry) => [entry.group, entry]));
const explicitGroups: Readonly<Record<string, FixturePresentationGroup>> = {
  C002: 'bench',
  C012: 'locker',
  C013: 'vending-machine',
  C014: 'atm',
  C101: 'platform-gate',
  C104: 'ticket-gate',
};

export function fixturePresentationStyle(category: unknown): FixturePresentationStyle {
  const definition = resolveIndoorMapCategory('Fixture', category);
  const explicit = explicitGroups[definition.code];
  if (explicit) return styleByGroup.get(explicit)!;
  if (!definition.known) return styleByGroup.get('unknown')!;
  if (definition.visual.group === 'column' || definition.visual.group === 'wall') return styleByGroup.get(definition.visual.group)!;
  if (definition.visual.group === 'furniture') return styleByGroup.get(definition.visual.geometry === 'low-solid' ? 'furniture-low' : 'furniture-solid')!;
  if (definition.visual.group === 'barrier') {
    const group = definition.visual.geometry === 'thin-barrier' ? 'barrier-thin' : definition.visual.geometry === 'low-solid' ? 'barrier-low' : 'barrier-solid';
    return styleByGroup.get(group)!;
  }
  if (definition.visual.group === 'fixture') return styleByGroup.get('fixture')!;
  return styleByGroup.get('unknown')!;
}

export function groupFixtureFeatures(features: ProcessedFeature[]): Map<FixturePresentationStyle, ProcessedFeature[]> {
  const grouped = new Map<FixturePresentationStyle, ProcessedFeature[]>();
  for (const feature of features) {
    if (feature.layer !== 'Fixture') continue;
    const presentation = fixturePresentationStyle(feature.properties.category);
    const group = grouped.get(presentation) ?? [];
    group.push(feature);
    grouped.set(presentation, group);
  }
  return grouped;
}
