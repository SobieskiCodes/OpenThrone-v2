import { describe, it, expect } from 'vitest';
import { getLevelForXP, getXPForLevel, getXPToNextLevel, levelXPArray } from '../xp';

describe('XP System', () => {
  it('should return level 0 for 0 XP', () => {
    expect(getLevelForXP(0)).toBe(0);
  });

  it('should return level 1 for exactly 4000 XP', () => {
    expect(getLevelForXP(4000)).toBe(1);
  });

  it('should return level 1 for 7999 XP (just below level 2)', () => {
    expect(getLevelForXP(7999)).toBe(1);
  });

  it('should return level 2 for 8000 XP', () => {
    expect(getLevelForXP(8000)).toBe(2);
  });

  it('should return level 100 for max XP', () => {
    expect(getLevelForXP(5251000)).toBe(100);
  });

  it('should return level 100 for XP beyond max', () => {
    expect(getLevelForXP(99999999)).toBe(100);
  });

  it('should return correct XP for level 1', () => {
    expect(getXPForLevel(1)).toBe(4000);
  });

  it('should return correct XP for level 50', () => {
    expect(getXPForLevel(50)).toBe(1376000);
  });

  it('should calculate XP to next level', () => {
    // At 0 XP, need 4000 to reach level 1
    expect(getXPToNextLevel(0)).toBe(4000);
  });

  it('should have 100 levels defined', () => {
    expect(levelXPArray).toHaveLength(100);
  });
});
