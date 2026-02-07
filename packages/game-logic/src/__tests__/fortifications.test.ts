import { describe, it, expect } from 'vitest';
import { Fortifications, getFortificationByLevel, getNextFortification } from '../fortifications';

describe('Fortifications', () => {
  it('should have 24 fortification levels', () => {
    expect(Fortifications).toHaveLength(24);
  });

  it('should start with Manor at level 1', () => {
    const manor = getFortificationByLevel(1);
    expect(manor).toBeDefined();
    expect(manor?.name).toBe('Manor');
    expect(manor?.cost).toBe(0);
    expect(manor?.hitpoints).toBe(50);
  });

  it('should find Fortress at level 10', () => {
    const fortress = getFortificationByLevel(10);
    expect(fortress).toBeDefined();
    expect(fortress?.name).toBe('Fortress');
    expect(fortress?.defenseBonusPercentage).toBe(50);
  });

  it('should return next fortification', () => {
    const next = getNextFortification(1);
    expect(next).toBeDefined();
    expect(next?.name).toBe('Village');
    expect(next?.level).toBe(2);
  });

  it('should return undefined for next after max level', () => {
    const next = getNextFortification(24);
    expect(next).toBeUndefined();
  });
});
