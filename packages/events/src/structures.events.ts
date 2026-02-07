export class StructureUpgradedEvent {
  constructor(
    public readonly playerId: string,
    public readonly upgradeType: string,
    public readonly newLevel: number,
    public readonly goldSpent: bigint,
  ) {}
}
