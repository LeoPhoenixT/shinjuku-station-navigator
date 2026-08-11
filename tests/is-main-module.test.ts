import { describe, expect, it } from 'vitest';
import { isMainModule, portablePath } from '../scripts/data/is-main-module';

describe('data-script entry points', () => {
  it('recognizes Windows paths as file URLs', () => {
    expect(isMainModule('file:///C:/work/script.js', 'C:\\work\\script.js')).toBe(true);
  });

  it('normalizes generated paths across operating systems', () => {
    expect(portablePath('shapefile\\facility\\B1')).toBe('shapefile/facility/B1');
  });
});
