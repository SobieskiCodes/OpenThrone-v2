export interface RankScoreInput {
  experience: number;
  fortLevel: number;
  houseLevel: number;
  totalUnits: number;
  totalItems: number;
}

export function calculateRankScore(input: RankScoreInput): number {
  return Math.round(
    0.7 * input.experience +
    0.2 * input.fortLevel * 1000 +
    0.1 * input.houseLevel * 1000 +
    0.004 * input.totalUnits +
    0.003 * input.totalItems,
  );
}
