export {
  UnitTypes,
  getUnitByTypeAndLevel,
  getUnitsOfType,
} from './units';

export {
  Fortifications,
  getFortificationByLevel,
  getNextFortification,
} from './fortifications';

export {
  levelXPArray,
  getLevelForXP,
  getXPForLevel,
  getXPToNextLevel,
} from './xp';

export {
  Bonuses,
  DefaultLevelBonus,
  getBonusesForRaceAndClass,
} from './bonuses';

export {
  toLocale,
  fromLocale,
  convertToHumanReadable,
  stringifyObj,
} from './formatting';

export {
  ItemTypes,
  getItemDefinition,
  getItemsByUsage,
  getItemsByUsageAndType,
} from './items';

export {
  BattleUpgrades,
  getBattleUpgradesByType,
} from './battle-upgrades';

export {
  RECRUIT_LINK_CITIZENS_BONUS,
  RECRUIT_LINK_IP_COOLDOWN_HOURS,
  RECRUIT_LINK_MAX_PER_DAY,
  calculateAutoRecruitCitizens,
  calculateRecruitLinkBonus,
} from './recruitment';

export { calculateGoldPerTurn } from './economy';

export {
  calculateFullStats,
  calculateGoldPerTurnBreakdown,
  calculateCitizensPerDayBreakdown,
} from './stats';
export type {
  StatBreakdown,
  FullStatBreakdown,
  GoldPerTurnBreakdown,
  CitizensPerDayBreakdown,
  StatCalcInput,
} from './stats';

export {
  calculateRankScore,
} from './rankings';
export type { RankScoreInput } from './rankings';

export {
  resolveAttack,
  resolveIntel,
  resolveAssassination,
  resolveInfiltration,
  runSimulation,
  buildCombatProfile,
  DEFAULT_COMBAT_CONFIG,
} from './combat';
export type {
  CombatConfig,
  CombatProfile,
  AttackResult,
  IntelResult,
  AssassinationResult,
  InfiltrationResult,
  SimulationSummary,
  CasualtyDetail,
  FullPlayerData,
} from './combat';

export {
  EconomyUpgrades,
  OffensiveUpgrades,
  SpyUpgrades,
  SentryUpgrades,
  ArmoryUpgrades,
  HouseUpgrades,
  getEconomyUpgradeByLevel,
  getOffensiveUpgradeByLevel,
  getSpyUpgradeByLevel,
  getSentryUpgradeByLevel,
  getArmoryUpgradeByLevel,
  getHouseUpgradeByLevel,
} from './structure-upgrades';
