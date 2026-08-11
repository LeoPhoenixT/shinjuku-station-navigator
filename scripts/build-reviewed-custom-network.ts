import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseOfficialNetwork, type LocalPoint } from '../src/schema/processed.js';
import { parseReviewedCustomNetwork, type ReviewedCustomNetworkDataset } from '../src/schema/reviewedCustomNetwork.js';
import { isMainModule } from './data/is-main-module.js';

const SOURCE = 'data/reviewed-custom-network.source.json';
const NETWORK = 'public/data/processed/jr-shinjuku-ticket-gates-b1-official-network.json';
const OUTPUT = 'public/data/processed/shinjuku-reviewed-custom-network.json';

interface AuthorNode {
  id: string;
  name: string;
  floorId: string;
  role: 'gate' | 'turn';
  coordinates: LocalPoint;
}

interface AuthorEdge {
  id: string;
  from: string;
  to: string;
  kind: 'corridor' | 'gate';
}

interface AuthorSource {
  schemaVersion: 1;
  revision: string;
  approval: ReviewedCustomNetworkDataset['approval'];
  nodes: AuthorNode[];
  edges: AuthorEdge[];
  placeAttachments: ReviewedCustomNetworkDataset['placeAttachments'];
}

function authorSource(value: unknown): AuthorSource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Reviewed custom source must be an object.');
  const source = value as Partial<AuthorSource>;
  if (source.schemaVersion !== 1 || typeof source.revision !== 'string' || source.approval?.status !== 'reviewed' || !Array.isArray(source.nodes) || !Array.isArray(source.edges) || !Array.isArray(source.placeAttachments)) {
    throw new Error('Reviewed custom source has invalid top-level metadata.');
  }
  return source as AuthorSource;
}

export function buildReviewedCustomNetwork(networkInput = NETWORK, output = OUTPUT, sourceInput = SOURCE): ReviewedCustomNetworkDataset {
  const official = parseOfficialNetwork(JSON.parse(readFileSync(networkInput, 'utf8')) as unknown);
  const source = authorSource(JSON.parse(readFileSync(sourceInput, 'utf8')) as unknown);
  const coordinates = new Map<string, LocalPoint>([
    ...official.nodes.map((node) => [node.id, node.coordinates] as const),
    ...source.nodes.map((node) => [node.id, node.coordinates] as const),
  ]);
  const edges = source.edges.map((edge) => {
    const start = coordinates.get(edge.from);
    const end = coordinates.get(edge.to);
    if (!start || !end) throw new Error(`Reviewed custom source edge ${edge.id} has an invalid endpoint.`);
    return {
      ...edge,
      distanceMeters: Number(Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]).toFixed(3)),
      direction: 'both' as const,
      accessibility: 'unknown' as const,
      geometry: [start, end] as [LocalPoint, LocalPoint],
    };
  });
  const dataset: ReviewedCustomNetworkDataset = {
    schemaVersion: 1,
    revision: source.revision,
    generatedAt: new Date(0).toISOString(),
    approval: source.approval,
    coordinateSystem: official.coordinateSystem,
    nodes: source.nodes,
    edges,
    placeAttachments: source.placeAttachments,
    statistics: {
      nodeCount: source.nodes.length,
      edgeCount: edges.length,
      attachedPlaceCount: source.placeAttachments.length,
    },
  };
  parseReviewedCustomNetwork(dataset, official);
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(dataset, null, 2)}\n`);
  return dataset;
}

if (isMainModule(import.meta.url)) {
  const dataset = buildReviewedCustomNetwork(process.argv[2] ?? NETWORK, process.argv[3] ?? OUTPUT, process.argv[4] ?? SOURCE);
  console.log(`Built ${dataset.edges.length} reviewed custom links with ${dataset.nodes.length} explicit nodes.`);
}
