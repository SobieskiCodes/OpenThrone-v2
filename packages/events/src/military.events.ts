import type { UnitType, ItemType, ItemUsage, BattleUpgradeType } from '@openthrone/shared';

export class UnitsTrainedEvent {
  constructor(
    public readonly playerId: string,
    public readonly units: Array<{ unitType: UnitType; level: number; quantity: number }>,
    public readonly goldSpent: bigint,
  ) {}
}

export class UnitsUntrainedEvent {
  constructor(
    public readonly playerId: string,
    public readonly units: Array<{ unitType: UnitType; level: number; quantity: number }>,
    public readonly citizensReturned: number,
  ) {}
}

export class UnitsConvertedEvent {
  constructor(
    public readonly playerId: string,
    public readonly fromType: UnitType,
    public readonly fromLevel: number,
    public readonly toType: UnitType,
    public readonly toLevel: number,
    public readonly quantity: number,
  ) {}
}

export class ItemEquippedEvent {
  constructor(
    public readonly playerId: string,
    public readonly itemType: ItemType,
    public readonly usage: ItemUsage,
    public readonly level: number,
    public readonly quantity: number,
    public readonly goldSpent: bigint,
  ) {}
}

export class ItemUnequippedEvent {
  constructor(
    public readonly playerId: string,
    public readonly itemType: ItemType,
    public readonly usage: ItemUsage,
    public readonly level: number,
    public readonly quantity: number,
  ) {}
}
