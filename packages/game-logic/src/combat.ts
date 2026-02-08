import { getFortificationByLevel } from './fortifications';
import { getLevelForXP } from './xp';

// ─── Combat Config ──────────────────────────────────────────────────

export interface CombatConfig {
  // Strength variance (random roll on each side)
  strengthVarianceMin: number;
  strengthVarianceMax: number;

  // Fort defense bonus (% of defense stat added based on fort HP)
  fortDefenseMultiplier: number;

  // Casualty rates
  attackerCasualtyBase: number;
  defenderCasualtyBase: number;
  defenderCasualtyOnWin: number;
  maxCasualtyPercent: number;

  // Casualty distribution
  defenseUnitCasualtyShare: number;
  citizenVulnerabilityThreshold: number;
  citizenCasualtyShare: number;

  // Gold theft (attacker win only, hand gold only)
  goldTheftBasePercent: number;
  goldTheftVarianceMin: number;
  goldTheftVarianceMax: number;
  goldTheftMaxPercent: number;

  // Fort damage (attacker win only)
  fortDamageBase: number;
  fortDamageVariance: number;
  fortDamageRatioScaler: number;

  // XP
  xpBase: number;
  xpWinnerMultiplier: number;
  xpLoserMultiplier: number;
  xpLevelDiffBonus: number;

  // Spy: Intel
  intelRevealPerSpy: number;
  intelMaxReveal: number;
  intelSpyLossOnFail: number;
  intelSpyLossOnSuccess: number;

  // Spy: Assassination
  assassinKillBase: number;
  assassinKillVarianceMin: number;
  assassinKillVarianceMax: number;
  assassinSpyLossOnFail: number;
  assassinSpyLossOnSuccess: number;

  // Spy: Infiltration
  infiltrationDamagePerSpy: number;
  infiltrationDamageVariance: number;
  infiltrationSpyLossOnFail: number;
  infiltrationSpyLossOnSuccess: number;

  // Rate limits
  maxAttacksPerTargetPer24h: number;
  maxSpyPerTargetPer24h: number;
}

export const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  strengthVarianceMin: 0.92,
  strengthVarianceMax: 1.08,

  fortDefenseMultiplier: 0.30,

  attackerCasualtyBase: 0.008,
  defenderCasualtyBase: 0.012,
  defenderCasualtyOnWin: 0.004,
  maxCasualtyPercent: 0.05,

  defenseUnitCasualtyShare: 0.70,
  citizenVulnerabilityThreshold: 0.25,
  citizenCasualtyShare: 0.10,

  goldTheftBasePercent: 0.05,
  goldTheftVarianceMin: 0.80,
  goldTheftVarianceMax: 1.20,
  goldTheftMaxPercent: 0.25,

  fortDamageBase: 3,
  fortDamageVariance: 5,
  fortDamageRatioScaler: 0.5,

  xpBase: 500,
  xpWinnerMultiplier: 0.75,
  xpLoserMultiplier: 0.25,
  xpLevelDiffBonus: 50,

  intelRevealPerSpy: 10,
  intelMaxReveal: 100,
  intelSpyLossOnFail: 1.0,
  intelSpyLossOnSuccess: 0.0,

  assassinKillBase: 0.02,
  assassinKillVarianceMin: 0.80,
  assassinKillVarianceMax: 1.20,
  assassinSpyLossOnFail: 1.0,
  assassinSpyLossOnSuccess: 0.10,

  infiltrationDamagePerSpy: 8,
  infiltrationDamageVariance: 4,
  infiltrationSpyLossOnFail: 1.0,
  infiltrationSpyLossOnSuccess: 0.15,

  maxAttacksPerTargetPer24h: 5,
  maxSpyPerTargetPer24h: 3,
};

// ─── Combat Profile ─────────────────────────────────────────────────

export interface CombatProfile {
  offense: number;
  defense: number;
  spy: number;
  sentry: number;
  gold: number;
  goldInBank: number;
  fortLevel: number;
  fortHitpoints: number;
  level: number;
  population: number;
  offenseUnits: number;
  defenseUnits: number;
  spyUnits: number;
  sentryUnits: number;
  citizenUnits: number;
}

// ─── Result Types ───────────────────────────────────────────────────

export interface CasualtyDetail {
  offenseUnits: number;
  defenseUnits: number;
  citizenUnits: number;
  spyUnits: number;
  sentryUnits: number;
  total: number;
}

export interface AttackResult {
  attackerWins: boolean;
  ratio: number;
  roll: number;
  effectiveDefense: number;
  fortShield: number;
  attackerCasualties: CasualtyDetail;
  defenderCasualties: CasualtyDetail;
  goldStolen: number;
  fortDamage: number;
  attackerXP: number;
  defenderXP: number;
}

export interface IntelResult {
  success: boolean;
  revealPercent: number;
  spiesLost: number;
  spiesSurvived: number;
}

export interface AssassinationResult {
  success: boolean;
  unitsKilled: number;
  targetUnitType: string;
  spiesLost: number;
  spiesSurvived: number;
}

export interface InfiltrationResult {
  success: boolean;
  fortDamage: number;
  spiesLost: number;
  spiesSurvived: number;
}

export interface SimulationSummary {
  runs: number;
  type: string;
  winRate: number;
  avgGoldStolen: number;
  avgAttackerCasualties: number;
  avgDefenderCasualties: number;
  avgFortDamage: number;
  avgAttackerXP: number;
  avgDefenderXP: number;
  // Histogram buckets for charts
  goldStolenBuckets: { label: string; count: number }[];
  attackerCasualtyBuckets: { label: string; count: number }[];
  defenderCasualtyBuckets: { label: string; count: number }[];
  fortDamageBuckets: { label: string; count: number }[];
  // Spy-specific
  avgRevealPercent?: number;
  avgUnitsKilled?: number;
  avgSpiesLost?: number;
}

// ─── Helper Functions ───────────────────────────────────────────────

function defaultRng(): number {
  return Math.random();
}

function rollRange(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distributeCasualties(
  totalLoss: number,
  profile: CombatProfile,
  isAttacker: boolean,
  config: CombatConfig,
): CasualtyDetail {
  const result: CasualtyDetail = {
    offenseUnits: 0,
    defenseUnits: 0,
    citizenUnits: 0,
    spyUnits: 0,
    sentryUnits: 0,
    total: 0,
  };

  if (totalLoss <= 0) return result;

  if (isAttacker) {
    // Attacker casualties come from offense units
    result.offenseUnits = Math.min(totalLoss, profile.offenseUnits);
    result.total = result.offenseUnits;
  } else {
    // Defender: 70% defense units, rest from military, citizens only if defense < 25% of pop
    const defShare = Math.floor(totalLoss * config.defenseUnitCasualtyShare);
    result.defenseUnits = Math.min(defShare, profile.defenseUnits);

    let remaining = totalLoss - result.defenseUnits;
    if (remaining <= 0) {
      result.total = result.defenseUnits;
      return result;
    }

    // Spread rest across offense, spy, sentry
    const milPool = profile.offenseUnits + profile.spyUnits + profile.sentryUnits;
    if (milPool > 0) {
      const fromMil = Math.min(remaining, milPool);
      const offShare = milPool > 0 ? profile.offenseUnits / milPool : 0;
      const spyShare = milPool > 0 ? profile.spyUnits / milPool : 0;

      result.offenseUnits = Math.min(Math.round(fromMil * offShare), profile.offenseUnits);
      result.spyUnits = Math.min(Math.round(fromMil * spyShare), profile.spyUnits);
      result.sentryUnits = Math.min(fromMil - result.offenseUnits - result.spyUnits, profile.sentryUnits);
      remaining -= (result.offenseUnits + result.spyUnits + result.sentryUnits);
    }

    // Citizens only if defense < 25% of population
    if (remaining > 0 && profile.defenseUnits < profile.population * config.citizenVulnerabilityThreshold) {
      const maxCitCas = Math.floor(profile.citizenUnits * config.citizenCasualtyShare);
      result.citizenUnits = Math.min(remaining, maxCitCas);
    }

    result.total = result.offenseUnits + result.defenseUnits + result.spyUnits +
      result.sentryUnits + result.citizenUnits;
  }

  return result;
}

// ─── Attack Resolution ──────────────────────────────────────────────

export function resolveAttack(
  attacker: CombatProfile,
  defender: CombatProfile,
  config: CombatConfig,
  rng: () => number = defaultRng,
): AttackResult {
  // 1. Fort shield
  const fort = getFortificationByLevel(defender.fortLevel);
  const fortMaxHP = fort?.hitpoints ?? 50;
  const fortHPRatio = clamp(defender.fortHitpoints / Math.max(fortMaxHP, 1), 0, 1);
  const fortShield = fortHPRatio * config.fortDefenseMultiplier;
  const effectiveDefense = defender.defense * (1 + fortShield);

  // 2. Random roll
  const roll = rollRange(config.strengthVarianceMin, config.strengthVarianceMax, rng);
  const ratio = (attacker.offense * roll) / Math.max(effectiveDefense, 1);

  // 3. Winner
  const attackerWins = ratio >= 1.0;

  // 4. Casualties
  let attackerRate: number;
  let defenderRate: number;

  if (attackerWins) {
    attackerRate = config.attackerCasualtyBase * (1 / Math.max(ratio, 0.5));
    defenderRate = config.defenderCasualtyBase * Math.min(ratio, 3.0);
  } else {
    attackerRate = config.attackerCasualtyBase * Math.min(1 / Math.max(ratio, 0.1), 3.0);
    defenderRate = config.defenderCasualtyOnWin;
  }

  attackerRate = clamp(attackerRate, 0, config.maxCasualtyPercent);
  defenderRate = clamp(defenderRate, 0, config.maxCasualtyPercent);

  const attackerTotalArmy = attacker.offenseUnits + attacker.defenseUnits +
    attacker.spyUnits + attacker.sentryUnits;
  const defenderTotalArmy = defender.offenseUnits + defender.defenseUnits +
    defender.spyUnits + defender.sentryUnits + defender.citizenUnits;

  const attackerLossCount = Math.round(attackerTotalArmy * attackerRate);
  const defenderLossCount = Math.round(defenderTotalArmy * defenderRate);

  const attackerCasualties = distributeCasualties(attackerLossCount, attacker, true, config);
  const defenderCasualties = distributeCasualties(defenderLossCount, defender, false, config);

  // 5. Gold theft (attacker win only, hand gold only)
  let goldStolen = 0;
  if (attackerWins) {
    const theftRate = config.goldTheftBasePercent *
      rollRange(config.goldTheftVarianceMin, config.goldTheftVarianceMax, rng);
    const cappedRate = Math.min(theftRate, config.goldTheftMaxPercent);
    goldStolen = Math.floor(defender.gold * cappedRate);
  }

  // 6. Fort damage (attacker win only)
  let fortDamage = 0;
  if (attackerWins) {
    fortDamage = Math.round(
      config.fortDamageBase +
      rollRange(0, config.fortDamageVariance, rng) +
      ratio * config.fortDamageRatioScaler
    );
    fortDamage = Math.min(fortDamage, defender.fortHitpoints);
  }

  // 7. XP
  const levelDiff = Math.abs(attacker.level - defender.level);
  const totalXP = config.xpBase + levelDiff * config.xpLevelDiffBonus;
  const attackerXP = Math.round(totalXP * (attackerWins ? config.xpWinnerMultiplier : config.xpLoserMultiplier));
  const defenderXP = Math.round(totalXP * (attackerWins ? config.xpLoserMultiplier : config.xpWinnerMultiplier));

  return {
    attackerWins,
    ratio,
    roll,
    effectiveDefense,
    fortShield,
    attackerCasualties,
    defenderCasualties,
    goldStolen,
    fortDamage,
    attackerXP,
    defenderXP,
  };
}

// ─── Spy: Intel ─────────────────────────────────────────────────────

export function resolveIntel(
  attacker: CombatProfile,
  defender: CombatProfile,
  spiesSent: number,
  config: CombatConfig,
): IntelResult {
  const success = attacker.spy > defender.sentry;
  const revealPercent = success
    ? Math.min(spiesSent * config.intelRevealPerSpy, config.intelMaxReveal)
    : 0;

  const lossRate = success ? config.intelSpyLossOnSuccess : config.intelSpyLossOnFail;
  const spiesLost = Math.round(spiesSent * lossRate);

  return {
    success,
    revealPercent,
    spiesLost,
    spiesSurvived: spiesSent - spiesLost,
  };
}

// ─── Spy: Assassination ─────────────────────────────────────────────

export function resolveAssassination(
  attacker: CombatProfile,
  defender: CombatProfile,
  assassinsSent: number,
  targetUnitType: string,
  config: CombatConfig,
  rng: () => number = defaultRng,
): AssassinationResult {
  const success = attacker.spy > defender.sentry;

  let unitsKilled = 0;
  if (success) {
    const spyRatio = attacker.spy / Math.max(defender.sentry, 1);
    const killRate = config.assassinKillBase * spyRatio *
      rollRange(config.assassinKillVarianceMin, config.assassinKillVarianceMax, rng);
    // Get target pool size
    let targetPool = 0;
    if (targetUnitType === 'OFFENSE') targetPool = defender.offenseUnits;
    else if (targetUnitType === 'DEFENSE') targetPool = defender.defenseUnits;
    else if (targetUnitType === 'SPY') targetPool = defender.spyUnits;
    else if (targetUnitType === 'SENTRY') targetPool = defender.sentryUnits;
    else if (targetUnitType === 'WORKER') targetPool = 0; // Can't assassinate workers
    else if (targetUnitType === 'CITIZEN') targetPool = defender.citizenUnits;

    unitsKilled = Math.min(Math.round(targetPool * killRate * assassinsSent), targetPool);
  }

  const lossRate = success ? config.assassinSpyLossOnSuccess : config.assassinSpyLossOnFail;
  const spiesLost = Math.round(assassinsSent * lossRate);

  return {
    success,
    unitsKilled,
    targetUnitType,
    spiesLost,
    spiesSurvived: assassinsSent - spiesLost,
  };
}

// ─── Spy: Infiltration ──────────────────────────────────────────────

export function resolveInfiltration(
  attacker: CombatProfile,
  defender: CombatProfile,
  infiltratorsSent: number,
  config: CombatConfig,
  rng: () => number = defaultRng,
): InfiltrationResult {
  const success = attacker.spy > defender.sentry;

  let fortDamage = 0;
  if (success) {
    const lossRate = config.infiltrationSpyLossOnSuccess;
    const surviving = Math.round(infiltratorsSent * (1 - lossRate));
    const damagePerSpy = config.infiltrationDamagePerSpy +
      rollRange(-config.infiltrationDamageVariance, config.infiltrationDamageVariance, rng);
    fortDamage = Math.round(Math.max(0, damagePerSpy) * Math.max(surviving, 1));
    fortDamage = Math.min(fortDamage, defender.fortHitpoints);
  }

  const lossRate = success ? config.infiltrationSpyLossOnSuccess : config.infiltrationSpyLossOnFail;
  const spiesLost = Math.round(infiltratorsSent * lossRate);

  return {
    success,
    fortDamage,
    spiesLost,
    spiesSurvived: infiltratorsSent - spiesLost,
  };
}

// ─── Build Combat Profile ───────────────────────────────────────────

export interface FullPlayerData {
  race: string;
  playerClass: string;
  fortLevel: number;
  fortHitpoints: number;
  gold: number;
  goldInBank: number;
  experience: number;
  units: Array<{ unitType: string; level: number; quantity: number }>;
  items: Array<{ itemType: string; usage: string; level: number; quantity: number }>;
  battleUpgrades: Array<{ upgradeType: string; level: number; quantity: number }>;
  bonusPoints: Array<{ bonusType: string; level: number }>;
  structureUpgrades: Array<{ upgradeType: string; level: number }>;
  offense: number;
  defense: number;
  spy: number;
  sentry: number;
}

export function buildCombatProfile(data: FullPlayerData): CombatProfile {
  const offenseUnits = data.units
    .filter((u) => u.unitType === 'OFFENSE')
    .reduce((sum, u) => sum + u.quantity, 0);
  const defenseUnits = data.units
    .filter((u) => u.unitType === 'DEFENSE')
    .reduce((sum, u) => sum + u.quantity, 0);
  const spyUnits = data.units
    .filter((u) => u.unitType === 'SPY')
    .reduce((sum, u) => sum + u.quantity, 0);
  const sentryUnits = data.units
    .filter((u) => u.unitType === 'SENTRY')
    .reduce((sum, u) => sum + u.quantity, 0);
  const citizenUnits = data.units
    .filter((u) => u.unitType === 'CITIZEN')
    .reduce((sum, u) => sum + u.quantity, 0);

  const population = offenseUnits + defenseUnits + spyUnits + sentryUnits + citizenUnits;

  return {
    offense: data.offense,
    defense: data.defense,
    spy: data.spy,
    sentry: data.sentry,
    gold: data.gold,
    goldInBank: data.goldInBank,
    fortLevel: data.fortLevel,
    fortHitpoints: data.fortHitpoints,
    level: getLevelForXP(data.experience),
    population,
    offenseUnits,
    defenseUnits,
    spyUnits,
    sentryUnits,
    citizenUnits,
  };
}

// ─── Simulation ─────────────────────────────────────────────────────

function createBuckets(values: number[], bucketCount: number = 10): { label: string; count: number }[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ label: String(min), count: values.length }];
  }

  const range = max - min;
  const bucketSize = range / bucketCount;
  const buckets: { label: string; count: number }[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const lo = Math.round(min + i * bucketSize);
    const hi = Math.round(min + (i + 1) * bucketSize);
    buckets.push({ label: `${lo}-${hi}`, count: 0 });
  }

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / bucketSize), bucketCount - 1);
    buckets[idx]!.count++;
  }

  return buckets;
}

export function runSimulation(
  attacker: CombatProfile,
  defender: CombatProfile,
  config: CombatConfig,
  runs: number,
  type: string,
  options?: { spiesSent?: number; targetUnitType?: string },
): SimulationSummary {
  const spiesSent = options?.spiesSent ?? 5;
  const targetUnitType = options?.targetUnitType ?? 'OFFENSE';

  if (type === 'attack') {
    return runAttackSimulation(attacker, defender, config, runs);
  } else if (type === 'intel') {
    return runIntelSimulation(attacker, defender, config, runs, spiesSent);
  } else if (type === 'assassinate') {
    return runAssassinationSimulation(attacker, defender, config, runs, spiesSent, targetUnitType);
  } else if (type === 'infiltrate') {
    return runInfiltrationSimulation(attacker, defender, config, runs, spiesSent);
  }

  return runAttackSimulation(attacker, defender, config, runs);
}

function runAttackSimulation(
  attacker: CombatProfile,
  defender: CombatProfile,
  config: CombatConfig,
  runs: number,
): SimulationSummary {
  let wins = 0;
  const goldArr: number[] = [];
  const atkCasArr: number[] = [];
  const defCasArr: number[] = [];
  const fortDmgArr: number[] = [];
  let totalAtkXP = 0;
  let totalDefXP = 0;

  for (let i = 0; i < runs; i++) {
    const result = resolveAttack(attacker, defender, config);
    if (result.attackerWins) wins++;
    goldArr.push(result.goldStolen);
    atkCasArr.push(result.attackerCasualties.total);
    defCasArr.push(result.defenderCasualties.total);
    fortDmgArr.push(result.fortDamage);
    totalAtkXP += result.attackerXP;
    totalDefXP += result.defenderXP;
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return {
    runs,
    type: 'attack',
    winRate: wins / runs,
    avgGoldStolen: Math.round(avg(goldArr)),
    avgAttackerCasualties: Math.round(avg(atkCasArr)),
    avgDefenderCasualties: Math.round(avg(defCasArr)),
    avgFortDamage: Math.round(avg(fortDmgArr) * 10) / 10,
    avgAttackerXP: Math.round(totalAtkXP / runs),
    avgDefenderXP: Math.round(totalDefXP / runs),
    goldStolenBuckets: createBuckets(goldArr),
    attackerCasualtyBuckets: createBuckets(atkCasArr),
    defenderCasualtyBuckets: createBuckets(defCasArr),
    fortDamageBuckets: createBuckets(fortDmgArr),
  };
}

function runIntelSimulation(
  attacker: CombatProfile,
  defender: CombatProfile,
  config: CombatConfig,
  runs: number,
  spiesSent: number,
): SimulationSummary {
  let wins = 0;
  let totalReveal = 0;
  let totalSpiesLost = 0;

  for (let i = 0; i < runs; i++) {
    const result = resolveIntel(attacker, defender, spiesSent, config);
    if (result.success) wins++;
    totalReveal += result.revealPercent;
    totalSpiesLost += result.spiesLost;
  }

  return {
    runs,
    type: 'intel',
    winRate: wins / runs,
    avgGoldStolen: 0,
    avgAttackerCasualties: 0,
    avgDefenderCasualties: 0,
    avgFortDamage: 0,
    avgAttackerXP: 0,
    avgDefenderXP: 0,
    goldStolenBuckets: [],
    attackerCasualtyBuckets: [],
    defenderCasualtyBuckets: [],
    fortDamageBuckets: [],
    avgRevealPercent: totalReveal / runs,
    avgSpiesLost: totalSpiesLost / runs,
  };
}

function runAssassinationSimulation(
  attacker: CombatProfile,
  defender: CombatProfile,
  config: CombatConfig,
  runs: number,
  assassinsSent: number,
  targetUnitType: string,
): SimulationSummary {
  let wins = 0;
  let totalKilled = 0;
  let totalSpiesLost = 0;

  for (let i = 0; i < runs; i++) {
    const result = resolveAssassination(attacker, defender, assassinsSent, targetUnitType, config);
    if (result.success) wins++;
    totalKilled += result.unitsKilled;
    totalSpiesLost += result.spiesLost;
  }

  return {
    runs,
    type: 'assassinate',
    winRate: wins / runs,
    avgGoldStolen: 0,
    avgAttackerCasualties: 0,
    avgDefenderCasualties: 0,
    avgFortDamage: 0,
    avgAttackerXP: 0,
    avgDefenderXP: 0,
    goldStolenBuckets: [],
    attackerCasualtyBuckets: [],
    defenderCasualtyBuckets: [],
    fortDamageBuckets: [],
    avgUnitsKilled: totalKilled / runs,
    avgSpiesLost: totalSpiesLost / runs,
  };
}

function runInfiltrationSimulation(
  attacker: CombatProfile,
  defender: CombatProfile,
  config: CombatConfig,
  runs: number,
  infiltratorsSent: number,
): SimulationSummary {
  let wins = 0;
  const fortDmgArr: number[] = [];
  let totalSpiesLost = 0;

  for (let i = 0; i < runs; i++) {
    const result = resolveInfiltration(attacker, defender, infiltratorsSent, config);
    if (result.success) wins++;
    fortDmgArr.push(result.fortDamage);
    totalSpiesLost += result.spiesLost;
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return {
    runs,
    type: 'infiltrate',
    winRate: wins / runs,
    avgGoldStolen: 0,
    avgAttackerCasualties: 0,
    avgDefenderCasualties: 0,
    avgFortDamage: Math.round(avg(fortDmgArr) * 10) / 10,
    avgAttackerXP: 0,
    avgDefenderXP: 0,
    goldStolenBuckets: [],
    attackerCasualtyBuckets: [],
    defenderCasualtyBuckets: [],
    fortDamageBuckets: createBuckets(fortDmgArr),
    avgSpiesLost: totalSpiesLost / runs,
  };
}
