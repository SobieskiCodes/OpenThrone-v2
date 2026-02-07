import type { PlayerBonusDefinition } from '@openthrone/shared';
import { PlayerRace, PlayerClass, BonusType } from '@openthrone/shared';

export const Bonuses: PlayerBonusDefinition[] = [
  { race: PlayerRace.HUMAN, bonusType: BonusType.OFFENSE, bonusAmount: 5 },
  { race: PlayerRace.GOBLIN, bonusType: BonusType.DEFENSE, bonusAmount: 5 },
  { race: PlayerRace.UNDEAD, bonusType: BonusType.OFFENSE, bonusAmount: 5 },
  { race: PlayerRace.ELF, bonusType: BonusType.DEFENSE, bonusAmount: 5 },
  { race: PlayerClass.FIGHTER, bonusType: BonusType.OFFENSE, bonusAmount: 5 },
  { race: PlayerClass.CLERIC, bonusType: BonusType.DEFENSE, bonusAmount: 5 },
  { race: PlayerClass.THIEF, bonusType: BonusType.INCOME, bonusAmount: 5 },
  { race: PlayerClass.ASSASSIN, bonusType: BonusType.INTEL, bonusAmount: 5 },
];

export const DefaultLevelBonus: Record<string, number> = {
  OFFENSE: 0,
  DEFENSE: 0,
  INTEL: 0,
  PRICES: 0,
  INCOME: 0,
};

/**
 * Returns all bonus definitions that apply to the given race and class.
 */
export function getBonusesForRaceAndClass(
  race: PlayerRace,
  playerClass: PlayerClass,
): PlayerBonusDefinition[] {
  return Bonuses.filter(
    (b) => b.race === race || b.race === playerClass,
  );
}
