import type { LevelXP } from '@openthrone/shared';

/**
 * XP curve: gap between levels starts at 1,000 and grows by 150 per level.
 * gap(n) = 1000 + 150*(n-1) where n is the level you're leaving.
 * Cumulative XP for level L = (L-1) * (1000 + 75*(L-2))
 */
function generateXPCurve(): LevelXP[] {
  const levels: LevelXP[] = [];
  for (let level = 1; level <= 100; level++) {
    const xp = level === 1 ? 0 : (level - 1) * (1000 + 75 * (level - 2));
    levels.push({ level, xp });
  }
  return levels;
}

export const levelXPArray: LevelXP[] = generateXPCurve();

/**
 * Returns the level corresponding to the given cumulative XP.
 * Level 1 starts at 0 XP, max level is 100.
 */
export function getLevelForXP(xp: number): number {
  for (let i = levelXPArray.length - 1; i >= 0; i--) {
    const entry = levelXPArray[i];
    if (entry && xp >= entry.xp) {
      return entry.level;
    }
  }
  return 1;
}

/**
 * Returns the XP threshold required to reach the given level.
 */
export function getXPForLevel(level: number): number {
  const entry = levelXPArray.find((e) => e.level === level);
  return entry ? entry.xp : 0;
}

/**
 * Returns the amount of XP needed to advance from the current XP to the next level.
 * Returns 0 if already at or beyond max level.
 */
export function getXPToNextLevel(currentXP: number): number {
  const currentLevel = getLevelForXP(currentXP);
  const nextEntry = levelXPArray.find((e) => e.level === currentLevel + 1);
  if (!nextEntry) {
    return 0;
  }
  return Math.max(0, nextEntry.xp - currentXP);
}
