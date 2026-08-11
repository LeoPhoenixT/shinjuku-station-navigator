import { readFileSync } from 'node:fs';

export type Point = [number, number];
export type ShapeGeometry = { type: 'Point'; coordinates: Point } | { type: 'PolyLine' | 'Polygon'; parts: Point[][] };
export interface ShapeRecord { recordNumber: number; geometry: ShapeGeometry | null }
export interface DbfRecord { recordNumber: number; properties: Record<string, string | number | boolean | null> }

const TEXT_DECODER = new TextDecoder('utf-8');

function trimNulls(value: Uint8Array): string {
  return TEXT_DECODER.decode(value).replace(/\0/g, '').trim();
}

export function readDbf(filePath: string): DbfRecord[] {
  const buffer = readFileSync(filePath);
  const count = buffer.readUInt32LE(4);
  const headerLength = buffer.readUInt16LE(8);
  const recordLength = buffer.readUInt16LE(10);
  const fields: Array<{ name: string; type: string; length: number; offset: number }> = [];
  let recordOffset = 1;
  for (let offset = 32; offset + 32 <= headerLength; offset += 32) {
    if (buffer[offset] === 0x0d) break;
    const rawName = buffer.subarray(offset, offset + 11);
    const nul = rawName.indexOf(0);
    const name = trimNulls(rawName.subarray(0, nul >= 0 ? nul : rawName.length));
    const type = String.fromCharCode(buffer[offset + 11]);
    const length = buffer[offset + 16];
    fields.push({ name, type, length, offset: recordOffset });
    recordOffset += length;
  }
  return Array.from({ length: count }, (_, index) => {
    const offset = headerLength + index * recordLength;
    const properties: Record<string, string | number | boolean | null> = {};
    for (const field of fields) {
      const raw = trimNulls(buffer.subarray(offset + field.offset, offset + field.offset + field.length));
      if (raw === '') properties[field.name] = null;
      else if (field.type === 'N' || field.type === 'F') properties[field.name] = Number(raw);
      else if (field.type === 'L') properties[field.name] = ['Y', 'T'].includes(raw.toUpperCase());
      else properties[field.name] = raw;
    }
    return { recordNumber: index + 1, properties };
  });
}

function readPoints(buffer: Buffer, offset: number, count: number): Point[] {
  return Array.from({ length: count }, (_, index) => [buffer.readDoubleLE(offset + index * 16), buffer.readDoubleLE(offset + index * 16 + 8)] as Point);
}

export function readShp(filePath: string): ShapeRecord[] {
  const buffer = readFileSync(filePath);
  const records: ShapeRecord[] = [];
  let offset = 100;
  while (offset + 8 <= buffer.byteLength) {
    const recordNumber = buffer.readInt32BE(offset);
    const contentBytes = buffer.readInt32BE(offset + 4) * 2;
    const contentOffset = offset + 8;
    const type = buffer.readInt32LE(contentOffset);
    let geometry: ShapeGeometry | null = null;
    if (type === 0) geometry = null;
    else if (type === 1) geometry = { type: 'Point', coordinates: [buffer.readDoubleLE(contentOffset + 4), buffer.readDoubleLE(contentOffset + 12)] };
    else if (type === 3 || type === 5) {
      const partCount = buffer.readInt32LE(contentOffset + 36);
      const pointCount = buffer.readInt32LE(contentOffset + 40);
      const partOffsets = Array.from({ length: partCount }, (_, index) => buffer.readInt32LE(contentOffset + 44 + index * 4));
      const points = readPoints(buffer, contentOffset + 44 + partCount * 4, pointCount);
      const parts = partOffsets.map((start, index) => points.slice(start, partOffsets[index + 1] ?? points.length));
      geometry = { type: type === 3 ? 'PolyLine' : 'Polygon', parts };
    }
    records.push({ recordNumber, geometry });
    offset += 8 + contentBytes;
  }
  return records;
}
