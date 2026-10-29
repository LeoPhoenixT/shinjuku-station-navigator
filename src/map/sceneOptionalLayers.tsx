import { useMemo } from 'react';
import type { RoutingGraph } from '../graph/types.js';
import type { OfficialNetworkDataset } from '../types/officialNetwork.js';
import type { ProcessedDataset } from '../types/processed.js';
import { allSourceLinkSegments } from './debugNetwork.js';
import { networkDirectionArrows } from './networkDirectionGeometry.js';
import { featureSegments, graphContextSegments, graphSegments } from './sceneGeometry.js';
import { NetworkDirectionArrows, Segments, StructuralOverlay, WideSegments } from './sceneLinePrimitives.js';
import { STRUCTURAL_LINE_STYLES } from './structuralLinePresentation.js';

const WALKING_NETWORK_HEIGHT = 1.15;
const WALKING_NETWORK_ARROW_HEIGHT = 1.55;

interface FloorSelection { floors: string[]; stacked: boolean }

export function OfficialNetworkLayer({ graph, floors, stacked }: FloorSelection & { graph: RoutingGraph }) {
  const segments = useMemo(() => graphContextSegments(graph, floors, stacked), [graph, floors, stacked]);
  const arrows = useMemo(() => networkDirectionArrows(graph.edges, floors, stacked), [graph.edges, floors, stacked]);
  return <>
    <WideSegments segments={segments.inside} color="#38bdf8" yOffset={WALKING_NETWORK_HEIGHT} lineWidth={1.4} opacity={0.9} depthTest={false} renderOrder={3000} />
    <WideSegments segments={segments.boundary} color="#f59e0b" yOffset={WALKING_NETWORK_HEIGHT + 0.03} lineWidth={1.4} opacity={0.9} depthTest={false} renderOrder={3001} />
    <WideSegments segments={segments.outside} color="#c084fc" yOffset={WALKING_NETWORK_HEIGHT + 0.06} lineWidth={1.4} opacity={0.9} depthTest={false} renderOrder={3002} />
    <NetworkDirectionArrows arrows={arrows} yOffset={WALKING_NETWORK_ARROW_HEIGHT} />
  </>;
}

export function SourceLinksLayer({ network, floors, stacked }: FloorSelection & { network: OfficialNetworkDataset }) {
  const segments = useMemo(() => allSourceLinkSegments(network, floors, stacked), [network, floors, stacked]);
  return <WideSegments segments={segments} color="#22d3ee" yOffset={WALKING_NETWORK_HEIGHT + 0.08} lineWidth={1.2} opacity={0.72} depthTest={false} renderOrder={3009} />;
}

export function TwsiLayer({ graph, floors, stacked }: FloorSelection & { graph: RoutingGraph }) {
  const segments = useMemo(() => graphSegments(graph, floors, stacked), [graph, floors, stacked]);
  return <Segments segments={segments} color="#84cc16" yOffset={0.38} />;
}

export function DrawingLayer({ features, activeFloors, contextFloors, stacked }: { features: ProcessedDataset['features']; activeFloors: string[]; contextFloors: string[]; stacked: boolean }) {
  const active = useMemo(() => featureSegments(features, 'Drawing', activeFloors, stacked), [activeFloors, features, stacked]);
  const context = useMemo(() => featureSegments(features, 'Drawing', contextFloors, stacked), [contextFloors, features, stacked]);
  return <>
    <StructuralOverlay segments={context} style={STRUCTURAL_LINE_STYLES.drawingContext} />
    <StructuralOverlay segments={active} style={STRUCTURAL_LINE_STYLES.drawingActive} />
  </>;
}
