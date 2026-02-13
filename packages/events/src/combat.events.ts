export class AttackExecutedEvent {
  constructor(
    public readonly attackerId: string,
    public readonly defenderId: string,
    public readonly winnerId: string,
    public readonly logId: number,
  ) {}
}

export class SpyMissionExecutedEvent {
  constructor(
    public readonly attackerId: string,
    public readonly defenderId: string,
    public readonly missionType: string,
    public readonly success: boolean,
    public readonly logId: number,
  ) {}
}

export class FortDamagedEvent {
  constructor(
    public readonly playerId: string,
    public readonly damageAmount: number,
    public readonly newHitpoints: number,
  ) {}
}

export class FortRepairedEvent {
  constructor(
    public readonly playerId: string,
    public readonly repairAmount: number,
    public readonly newHitpoints: number,
    public readonly goldSpent: bigint,
  ) {}
}
