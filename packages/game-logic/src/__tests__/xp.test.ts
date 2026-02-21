import { describe, it, expect } from 'vitest';
import { getLevelForXP, getXPForLevel, getXPToNextLevel, levelXPArray } from '../xp';

describe('XP System', () => {
  it('should return level 1 for 0 XP', () => {
    expect(getLevelForXP(0)).toBe(1);
  });

  it('should return level 2 for 1000 XP', () => {
    expect(getLevelForXP(1000)).toBe(2);
  });

  it('should return level 2 for 2149 XP (just below level 3)', () => {
    expect(getLevelForXP(2149)).toBe(2);
  });

  it('should return level 3 for 2150 XP', () => {
    expect(getLevelForXP(2150)).toBe(3);
  });

  it('should return level 1000 for max XP', () => {
    expect(getLevelForXP(75774150)).toBe(1000);
  });

  it('should return level 1000 for XP beyond max', () => {
    expect(getLevelForXP(999999999)).toBe(1000);
  });

  it('should return correct XP for level 1', () => {
    expect(getXPForLevel(1)).toBe(0);
  });

  it('should return correct XP for level 50', () => {
    expect(getXPForLevel(50)).toBe(225400);
  });

  it('should calculate XP to next level', () => {
    // At 0 XP (level 1), need 1000 to reach level 2
    expect(getXPToNextLevel(0)).toBe(1000);
  });

  it('should have 1000 levels defined', () => {
    expect(levelXPArray).toHaveLength(1000);
  });
});
