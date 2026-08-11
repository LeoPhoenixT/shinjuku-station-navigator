import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectDataset } from '../scripts/inspect-dataset.js';

function writeShp(file: string, type = 1): void {
  const b = Buffer.alloc(100);
  b.writeInt32BE(9994, 0);
  b.writeInt32BE(50, 24);
  b.writeInt32LE(1000, 28);
  b.writeInt32LE(type, 32);
  b.writeDoubleLE(139.7, 36); b.writeDoubleLE(35.68, 44); b.writeDoubleLE(139.71, 52); b.writeDoubleLE(35.69, 60);
  writeFileSync(file, b);
}

function writeDbf(file: string): void {
  const b = Buffer.alloc(32 + 32 + 1 + 11 + 1);
  b[0] = 0x03;
  b.writeUInt32LE(1, 4);
  b.writeUInt16LE(65, 8);
  b.writeUInt16LE(11, 10);
  b.write('NAME', 32, 'ascii');
  b.write('C', 43, 'ascii');
  b[48] = 10;
  b[64] = 0x0d;
  b[65] = 0x20;
  b.write('fixture   ', 66, 'ascii');
  b[76] = 0x1a;
  writeFileSync(file, b);
}

function makeRoot(): string {
  const root = path.join(tmpdir(), `inspector-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(path.join(root, 'facility', 'B1'), { recursive: true });
  return root;
}

describe('inspectDataset', () => {
  it('detects a valid shapefile group with stable schema and geometry summaries', () => {
    const root = makeRoot();
    const base = path.join(root, 'facility', 'B1', 'Sample_node');
    writeShp(`${base}.shp`);
    writeFileSync(`${base}.shx`, Buffer.alloc(100));
    writeDbf(`${base}.dbf`);
    writeFileSync(`${base}.prj`, 'GEOGCS["JGD2011"]');
    writeFileSync(`${base}.cpg`, 'UTF-8');

    const report = inspectDataset(root, path.join(root, 'report.json'));

    expect(report.summary.groupCount).toBe(1);
    expect(report.summary.validGroupCount).toBe(1);
    expect(report.groups[0].geometryType).toBe('Point');
    expect(report.groups[0].featureCount).toBe(1);
    expect(report.groups[0].dbfFields).toEqual([{ name: 'NAME', type: 'C', length: 10, decimalCount: 0 }]);
    expect(report.groups[0].encoding).toBe('UTF-8');
  });

  it('reports missing companion files and machine-readable feasibility', () => {
    const root = makeRoot();
    const base = path.join(root, 'facility', 'B1', 'Sample_link');
    writeShp(`${base}.shp`, 3);

    const report = inspectDataset(root, path.join(root, 'report.json'));

    expect(report.summary.missingCompanionCount).toBe(3);
    expect(report.groups[0].valid).toBe(false);
    expect(report.summary.routingFeasibility).toMatch(/Additional official resource required|Official Node\/Link data confirmed/);
  });
});
