import { describe, expect, it } from 'vitest';
import { groupSpaceFeatures, SPACE_PRESENTATION_STYLES, spacePresentationStyle } from '../src/map/spacePresentation';
import type { ProcessedFeature } from '../src/types/processed';

function feature(category: string): ProcessedFeature {
  return { id: category, sourceId: category, sourceRecord: 1, layer: 'Space', floorId: 'B1', geometry: { type: 'Polygon', parts: [] }, properties: { category } };
}

describe('semantic Space presentation', () => {
  it('assigns distinct treatments to core semantic categories', () => {
    const walkway = spacePresentationStyle('B029');
    const stairs = spacePresentationStyle('B021');
    const elevator = spacePresentationStyle('B022');
    const toilet = spacePresentationStyle('B007');
    const restricted = spacePresentationStyle('B026');

    expect(new Set([walkway.color, stairs.color, elevator.color, toilet.color, restricted.color])).toHaveLength(5);
    expect(stairs).toMatchObject({ group: 'stairs', emphasis: 'vertical' });
    expect(elevator.height).toBeGreaterThan(walkway.height);
    expect(restricted).toMatchObject({ group: 'restricted', emphasis: 'restricted' });
  });

  it('covers every planned Space visual group with a quiet unknown fallback', () => {
    expect(SPACE_PRESENTATION_STYLES.map(({ group }) => group)).toEqual(expect.arrayContaining(['stairs', 'elevator', 'escalator', 'toilet', 'multipurpose-toilet', 'platform', 'walkway', 'restricted', 'retail', 'office', 'waiting', 'ticket', 'information', 'room', 'unknown']));
    expect(spacePresentationStyle('B777')).toMatchObject({ group: 'unknown', opacity: 0.82 });
  });

  it('groups features into stable shared style batches', () => {
    const grouped = groupSpaceFeatures([feature('B021'), feature('B022'), feature('B021')]);
    expect([...grouped].map(([presentation, features]) => [presentation.group, features.map(({ id }) => id)])).toEqual([
      ['stairs', ['B021', 'B021']],
      ['elevator', ['B022']],
    ]);
  });
});
