export type Accessibility = 'yes' | 'no' | 'unknown';
export type GraphNodeKind = 'normal' | 'stairs' | 'escalator' | 'elevator' | 'gate';
export type GraphEdgeKind = 'corridor' | 'stairs' | 'escalator' | 'elevator' | 'gate';

export interface GraphNode {
  id: string;
  sourceId?: string;
  name?: string;
  x: number;
  y: number;
  z: number;
  floorId: string;
  facilityId: string;
  kind: GraphNodeKind;
  inOut?: 'outside' | 'boundary' | 'inside';
}

export interface GraphEdge {
  id: string;
  sourceId?: string;
  from: string;
  to: string;
  distanceMeters: number;
  direction: 'both' | 'forward' | 'reverse';
  kind: GraphEdgeKind;
  accessibility: Accessibility;
  accessibilityReasons?: string[];
  accessibilityUnknowns?: string[];
  floorFrom: string;
  floorTo: string;
  geometry: Array<[number, number, number]>;
}

export interface RejectedGraphEdge {
  sourceId: string;
  reason: 'missing-start-node' | 'missing-end-node' | 'missing-both-nodes' | 'malformed-geometry';
  startNode?: string;
  endNode?: string;
}

export interface RoutingGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  adjacency: Record<string, GraphEdge[]>;
  rejectedEdges: RejectedGraphEdge[];
}
