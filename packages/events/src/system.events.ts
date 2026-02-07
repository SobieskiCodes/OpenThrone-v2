export class TurnTickEvent {
  constructor(
    public readonly timestamp: Date,
    public readonly playersAffected: number,
  ) {}
}

export class DailyTickEvent {
  constructor(
    public readonly timestamp: Date,
    public readonly playersAffected: number,
  ) {}
}

export class RankingsRecalculatedEvent {
  constructor(
    public readonly timestamp: Date,
  ) {}
}
