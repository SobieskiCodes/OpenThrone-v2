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
  computeArmoryValue,
  computeArmoryResaleValue,
} from './items';

export {
  BattleUpgrades,
  getBattleUpgradesByType,
  getBattleUpgradeByTypeAndLevel,
  computeBattleUpgradeResaleValue,
} from './battle-upgrades';

export {
  RECRUIT_LINK_CITIZENS_BONUS,
  RECRUIT_LINK_IP_COOLDOWN_HOURS,
  RECRUIT_LINK_MAX_PER_DAY,
  AUTO_RECRUIT_POOL_CITIZENS,
  calculateAutoRecruitCitizens,
  calculateRecruitLinkBonus,
} from './recruitment';

export { calculateGoldPerTurn } from './economy';

export {
  calculateFullStats,
  calculateFullDetailedBreakdown,
  calculateGoldPerTurnBreakdown,
  calculateCitizensPerDayBreakdown,
} from './stats';
export type {
  StatBreakdown,
  FullStatBreakdown,
  DetailedStatBreakdown,
  FullDetailedBreakdown,
  LineItem,
  BonusLine,
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
  resolveStealGold,
  resolveSabotage,
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
  StealGoldResult,
  SabotageResult,
  SimulationSummary,
  CasualtyDetail,
  FullPlayerData,
} from './combat';

export {
  prioritizeActions,
  calculateTrainingAllocation,
  calculateBankAmount,
  scoreTarget,
  calculateTargetScore,
  addHumanNoise,
} from './bot-strategies';
export type {
  BotGameState,
  BotTarget,
  PrioritizedAction,
} from './bot-strategies';

// ─── Buildings (new system) ──────────────────────────────────────────
export {
  Buildings,
  getBuildingDefinition,
  getBuildingLevel,
  getNextBuildingLevel,
  getMaxBuildingLevel,
  canUpgradeBuilding,
  meetsBuildingRequirements,
  getBuildingUnlocksForLevelRange,
  MERCENARY_PRICE_MULTIPLIER,
  getMercenaryStockDistribution,
} from './buildings';

// ─── Proficiency Upgrades (OFFENSE/SPY/SENTRY — still active) ────
export {
  OffensiveUpgrades,
  SpyUpgrades,
  SentryUpgrades,
  getOffensiveUpgradeByLevel,
  getSpyUpgradeByLevel,
  getSentryUpgradeByLevel,
} from './structure-upgrades';

// ─── Cosmetics Shop ──────────────────────────────────────────────────
export {
  CosmeticType,
  NAME_COLORS,
  ICONS,
  ALL_COSMETICS,
  getCosmeticById,
  getCosmeticsByType,
} from './cosmetics';
export type { CosmeticDefinition } from './cosmetics';

// ─── Combat Simulator (detailed battle simulation) ───────────────────
export {
  runSingleSimulation,
  runBatchSimulation,
  DEFAULT_SIMULATOR_CONFIG,
} from './combat-simulator';
export type {
  SimulatorUnit,
  SimulatorItem,
  SimulatorProfile,
  SimulatorConfig,
  UnitCasualty,
  StatBreakdown as SimStatBreakdown,
  SingleSimResult,
  BatchSimResult,
} from './combat-simulator';
