import { describe, it, expect } from 'vitest';
import { CATEGORIES } from './PfDiagnosisSimplePage';
import { ASSET_CLASSES } from '../lib/rb/types';

describe('/pf の入力欄（CATEGORIES）', () => {
  it('ASSET_CLASSES のキーを過不足なく・重複なく含む', () => {
    const keys = CATEGORIES.flatMap(c => c.keys);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(ASSET_CLASSES.map(ac => ac.key).sort());
  });
});
