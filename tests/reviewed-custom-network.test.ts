import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildOfficialGraph } from '../src/graph/buildOfficialGraph';
import { mergeReviewedCustomGraph } from '../src/graph/buildReviewedCustomGraph';
import { astar } from '../src/routing/pathfinding';
import { parseNamedPlaces, parseOfficialNetwork } from '../src/schema/processed';
import { parseReviewedCustomNetwork } from '../src/schema/reviewedCustomNetwork';

const official = parseOfficialNetwork(JSON.parse(readFileSync('public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json', 'utf8')) as unknown);
const reviewed = parseReviewedCustomNetwork(JSON.parse(readFileSync('public/data/processed/shinjuku-reviewed-custom-network.json', 'utf8')) as unknown, official);
const places = parseNamedPlaces(JSON.parse(readFileSync('public/data/processed/shinjuku-b1-named-places.json', 'utf8')) as unknown, official, reviewed).places;
const graph = mergeReviewedCustomGraph(buildOfficialGraph(official), reviewed);

describe('reviewed custom JR B1 topology', () => {
  it('models the reviewed turns and West branch junction as explicit nodes', () => {
    expect(reviewed.nodes).toHaveLength(6);
    expect(reviewed.edges).toHaveLength(7);
    expect(reviewed.edges).toContainEqual(expect.objectContaining({
      from: 'custom:jr-b1-west-turn-1',
      to: 'custom:jr-b1-west-turn-3',
    }));
    expect(reviewed.edges).toContainEqual(expect.objectContaining({
      id: 'custom:jr-b1-east-west-concourse',
      from: 'custom:jr-b1-east-turn',
      to: 'custom:jr-b1-west-turn-1',
    }));
  });

  it('routes East and both West gate nodes through their reviewed branches', () => {
    expect(astar(graph, 'custom:jr-b1-east-gate', '4744a81cd91b4650808daccedb5decd9')?.edgeIds).toEqual([
      'custom:jr-b1-east-gate-to-turn',
      'custom:jr-b1-east-turn-to-official',
    ]);
    expect(astar(graph, 'custom:jr-b1-west-gate-1', 'fd2ecff60aea4697a921d26f7d4d7c91')?.edgeIds).toEqual([
      'custom:jr-b1-west-gate-1-to-turn-1',
      'custom:jr-b1-west-turn-1-to-turn-3',
      'custom:jr-b1-west-turn-3-to-official',
    ]);
    expect(astar(graph, 'custom:jr-b1-west-gate-3', 'fd2ecff60aea4697a921d26f7d4d7c91')?.edgeIds).toEqual([
      'custom:jr-b1-west-gate-3-to-turn-3',
      'custom:jr-b1-west-turn-3-to-official',
    ]);
  });

  it('routes directly across the shared concourse from East gate to both West gates', () => {
    expect(astar(graph, 'custom:jr-b1-east-gate', 'custom:jr-b1-west-gate-1')?.edgeIds).toEqual([
      'custom:jr-b1-east-gate-to-turn',
      'custom:jr-b1-east-west-concourse',
      'custom:jr-b1-west-gate-1-to-turn-1',
    ]);
    expect(astar(graph, 'custom:jr-b1-east-gate', 'custom:jr-b1-west-gate-3')?.edgeIds).toEqual([
      'custom:jr-b1-east-gate-to-turn',
      'custom:jr-b1-east-west-concourse',
      'custom:jr-b1-west-turn-1-to-turn-3',
      'custom:jr-b1-west-gate-3-to-turn-3',
    ]);
  });

  it('promotes the three reviewed gates to zero-distance routable attachments', () => {
    const attached = new Set(reviewed.placeAttachments.map(({ placeId }) => placeId));
    const gates = places.filter(({ id }) => attached.has(id));
    expect(gates).toHaveLength(3);
    for (const gate of gates) {
      expect(gate).toMatchObject({
        routable: true,
        access: {
          distanceMeters: 0,
          confidence: 'high',
          reviewStatus: 'reviewed',
          componentId: 0,
        },
      });
      expect(gate.access.nodeId).toMatch(/^custom:jr-b1-/);
    }
  });
});
