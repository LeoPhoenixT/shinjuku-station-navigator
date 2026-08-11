export type LayerName = 'Floor' | 'Space' | 'Opening' | 'Facility' | 'Fixture' | 'Drawing' | 'TWSI_Line' | 'TWSI_Point';

export interface PointGeometry { type: 'Point'; coordinates: [number, number, number] }
export interface MultiPartGeometry { type: 'Polygon' | 'PolyLine'; parts: Array<Array<[number, number, number]>> }
export type ProcessedGeometry = PointGeometry | MultiPartGeometry;

export interface ProcessedFeature {
  id: string;
  sourceId: string;
  sourceRecord: number;
  layer: LayerName;
  floorId?: string;
  geometry: ProcessedGeometry;
  properties: Record<string, unknown>;
}

export interface ProcessedDataset {
  schemaVersion: 1;
  importerVersion?: string;
  generatedAt?: string;
  source: { facilityId: string; facilityName: string; floorId: string; sourceDirectory: string; checksums?: Record<string, string> };
  coordinateSystem: { sourceCrs?: string; origin?: { lon: number; lat: number }; units: 'meters'; axes: { x: string; y: string; z: string } };
  layers?: Record<string, { featureCount: number; fields: string[] }>;
  features: ProcessedFeature[];
  statistics: { importedFeatures?: number; skippedRecords?: number; malformedRecords?: number; bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } };
}
