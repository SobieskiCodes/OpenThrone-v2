export class GoldDepositedEvent {
  constructor(
    public readonly playerId: string,
    public readonly amount: bigint,
    public readonly newBalance: bigint,
    public readonly newBankBalance: bigint,
  ) {}
}

export class GoldWithdrawnEvent {
  constructor(
    public readonly playerId: string,
    public readonly amount: bigint,
    public readonly newBalance: bigint,
    public readonly newBankBalance: bigint,
  ) {}
}

export class GoldTransferredEvent {
  constructor(
    public readonly fromPlayerId: string,
    public readonly toPlayerId: string,
    public readonly amount: bigint,
  ) {}
}

export class TurnGoldAwardedEvent {
  constructor(
    public readonly playerId: string,
    public readonly amount: bigint,
  ) {}
}
