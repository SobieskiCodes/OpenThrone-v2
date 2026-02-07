import type { AccountStatus } from '@openthrone/shared';

export class PlayerRegisteredEvent {
  constructor(
    public readonly playerId: string,
    public readonly displayName: string,
    public readonly email: string,
  ) {}
}

export class PlayerLoggedInEvent {
  constructor(
    public readonly playerId: string,
  ) {}
}

export class AccountStatusChangedEvent {
  constructor(
    public readonly playerId: string,
    public readonly oldStatus: AccountStatus,
    public readonly newStatus: AccountStatus,
    public readonly reason?: string,
  ) {}
}

export class LeveledUpEvent {
  constructor(
    public readonly playerId: string,
    public readonly oldLevel: number,
    public readonly newLevel: number,
  ) {}
}
