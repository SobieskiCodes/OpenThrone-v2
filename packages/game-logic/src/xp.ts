import type { LevelXP } from '@openthrone/shared';

export const levelXPArray: LevelXP[] = [
  { level: 1, xp: 0 },
  { level: 2, xp: 107 },
  { level: 3, xp: 251 },
  { level: 4, xp: 459 },
  { level: 5, xp: 734 },
  { level: 6, xp: 1076 },
  { level: 7, xp: 1488 },
  { level: 8, xp: 1969 },
  { level: 9, xp: 2522 },
  { level: 10, xp: 3147 },
  { level: 11, xp: 3844 },
  { level: 12, xp: 4615 },
  { level: 13, xp: 5460 },
  { level: 14, xp: 6379 },
  { level: 15, xp: 7374 },
  { level: 16, xp: 8444 },
  { level: 17, xp: 9591 },
  { level: 18, xp: 10814 },
  { level: 19, xp: 12114 },
  { level: 20, xp: 13492 },
  { level: 21, xp: 14948 },
  { level: 22, xp: 16482 },
  { level: 23, xp: 18095 },
  { level: 24, xp: 19787 },
  { level: 25, xp: 21558 },
  { level: 26, xp: 23409 },
  { level: 27, xp: 25339 },
  { level: 28, xp: 27350 },
  { level: 29, xp: 29442 },
  { level: 30, xp: 31615 },
  { level: 31, xp: 33868 },
  { level: 32, xp: 36203 },
  { level: 33, xp: 38620 },
  { level: 34, xp: 41119 },
  { level: 35, xp: 43700 },
  { level: 36, xp: 46363 },
  { level: 37, xp: 49109 },
  { level: 38, xp: 51938 },
  { level: 39, xp: 54849 },
  { level: 40, xp: 57845 },
  { level: 41, xp: 60923 },
  { level: 42, xp: 64086 },
  { level: 43, xp: 67332 },
  { level: 44, xp: 70662 },
  { level: 45, xp: 74077 },
  { level: 46, xp: 77576 },
  { level: 47, xp: 81160 },
  { level: 48, xp: 84829 },
  { level: 49, xp: 88583 },
  { level: 50, xp: 92422 },
  { level: 51, xp: 96346 },
  { level: 52, xp: 100356 },
  { level: 53, xp: 104452 },
  { level: 54, xp: 108634 },
  { level: 55, xp: 112902 },
  { level: 56, xp: 117255 },
  { level: 57, xp: 121696 },
  { level: 58, xp: 126223 },
  { level: 59, xp: 130836 },
  { level: 60, xp: 135536 },
  { level: 61, xp: 140324 },
  { level: 62, xp: 145198 },
  { level: 63, xp: 150160 },
  { level: 64, xp: 155209 },
  { level: 65, xp: 160345 },
  { level: 66, xp: 165570 },
  { level: 67, xp: 170882 },
  { level: 68, xp: 176282 },
  { level: 69, xp: 181770 },
  { level: 70, xp: 187346 },
  { level: 71, xp: 193011 },
  { level: 72, xp: 198764 },
  { level: 73, xp: 204605 },
  { level: 74, xp: 210536 },
  { level: 75, xp: 216555 },
  { level: 76, xp: 222663 },
  { level: 77, xp: 228860 },
  { level: 78, xp: 235146 },
  { level: 79, xp: 241522 },
  { level: 80, xp: 247987 },
  { level: 81, xp: 254541 },
  { level: 82, xp: 261185 },
  { level: 83, xp: 267919 },
  { level: 84, xp: 274742 },
  { level: 85, xp: 281656 },
  { level: 86, xp: 288660 },
  { level: 87, xp: 295753 },
  { level: 88, xp: 302937 },
  { level: 89, xp: 310212 },
  { level: 90, xp: 317577 },
  { level: 91, xp: 325032 },
  { level: 92, xp: 332578 },
  { level: 93, xp: 340215 },
  { level: 94, xp: 347943 },
  { level: 95, xp: 355762 },
  { level: 96, xp: 363671 },
  { level: 97, xp: 371672 },
  { level: 98, xp: 379764 },
  { level: 99, xp: 387948 },
  { level: 100, xp: 396223 },
];

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
