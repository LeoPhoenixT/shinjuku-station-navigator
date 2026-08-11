import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lonLatToLocalMeters, SHINJUKU_LOCAL_ORIGIN } from '../src/data/coordinates';
import { floorElevationMeters, normalizeFloorId } from '../src/data/floors';
import { convertDataset } from '../scripts/convert-dataset';
import { validateProcessedData } from '../scripts/validate-data';

function writePointShapefile(file: string, lon: number, lat: number): void {
  const buffer = Buffer.alloc(128);
  buffer.writeInt32BE(9994, 0);
  buffer.writeInt32BE(64, 24);
  buffer.writeInt32LE(1000, 28);
  buffer.writeInt32LE(1, 32);
  buffer.writeDoubleLE(lon, 36);
  buffer.writeDoubleLE(lat, 44);
  buffer.writeDoubleLE(lon, 52);
  buffer.writeDoubleLE(lat, 60);
  buffer.writeInt32BE(1, 100);
  buffer.writeInt32BE(10, 104);
  buffer.writeInt32LE(1, 108);
  buffer.writeDoubleLE(lon, 112);
  buffer.writeDoubleLE(lat, 120);
  writeFileSync(file, buffer);
}

function writeIdDbf(file: string, id: string): void {
  const fieldLength = 16;
  const headerLength = 65;
  const recordLength = fieldLength + 1;
  const buffer = Buffer.alloc(headerLength + recordLength + 1, 0);
  buffer[0] = 0x03;
  buffer.writeUInt32LE(1, 4);
  buffer.writeUInt16LE(headerLength, 8);
  buffer.writeUInt16LE(recordLength, 10);
  buffer.write('id', 32, 'ascii');
  buffer.write('C', 43, 'ascii');
  buffer[48] = fieldLength;
  buffer[64] = 0x0d;
  buffer[65] = 0x20;
  buffer.write(id.padEnd(fieldLength), 66, 'ascii');
  buffer[headerLength + recordLength] = 0x1a;
  writeFileSync(file, buffer);
}

function makeSourceFixture(root: string): void {
  mkdirSync(root, { recursive: true });
  const base = path.join(root, 'JrSin_B1_Floor');
  writePointShapefile(`${base}.shp`, SHINJUKU_LOCAL_ORIGIN.lon + 0.0001, SHINJUKU_LOCAL_ORIGIN.lat + 0.0001);
  writeIdDbf(`${base}.dbf`, 'fixture-floor');
  writeFileSync(`${base}.prj`, 'GEOGCS["JGD2011"]');
}

describe('coordinate conversion', () => {
  it('keeps the local origin at zero metres', () => {
    expect(lonLatToLocalMeters(SHINJUKU_LOCAL_ORIGIN)).toEqual({ x: 0, y: 0, z: -0 });
  });

  it('uses x east, y vertical, and z south', () => {
    const east = lonLatToLocalMeters({ lon: SHINJUKU_LOCAL_ORIGIN.lon + 0.001, lat: SHINJUKU_LOCAL_ORIGIN.lat }, SHINJUKU_LOCAL_ORIGIN, 7);
    const north = lonLatToLocalMeters({ lon: SHINJUKU_LOCAL_ORIGIN.lon, lat: SHINJUKU_LOCAL_ORIGIN.lat + 0.001 });
    expect(east.x).toBeGreaterThan(90);
    expect(east.y).toBe(7);
    expect(north.z).toBeLessThan(-100);
  });
});

describe('floor normalization', () => {
  it('normalizes common basement and outside floor IDs', () => {
    expect(normalizeFloorId('-1')).toBe('B1');
    expect(normalizeFloorId('b1')).toBe('B1');
    expect(normalizeFloorId('2out')).toBe('2out');
    expect(floorElevationMeters('B1')).toBe(-5);
  });
});

describe('phase 2 import', () => {
  it('produces deterministic, valid processed data with preserved source IDs', () => {
    const dir = path.join(tmpdir(), `shinjuku-phase2-${process.pid}`);
    const source = path.join(dir, 'source');
    const one = path.join(dir, 'one.json');
    const two = path.join(dir, 'two.json');
    const report = path.join(dir, 'report.json');
    try {
      makeSourceFixture(source);
      convertDataset(one, source);
      convertDataset(two, source);
      expect(readFileSync(one, 'utf8')).toBe(readFileSync(two, 'utf8'));
      const validation = validateProcessedData(one, report);
      expect(validation.valid).toBe(true);
      const data = JSON.parse(readFileSync(one, 'utf8'));
      expect(data.coordinateSystem.units).toBe('meters');
      expect(data.features).toHaveLength(1);
      expect(data.features[0].sourceId).toBe('fixture-floor');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
