export class PlayerRecruitedEvent {
  constructor(
    public readonly referrerId: string,
    public readonly recruitedPlayerId: string | null,
    public readonly ipAddress: string,
    public readonly citizensAwarded: number,
  ) {}
}

export class AutoRecruitEvent {
  constructor(
    public readonly playerId: string,
    public readonly citizensGained: number,
    public readonly houseLevel: number,
  ) {}
}
