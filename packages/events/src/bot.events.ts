export class BotSessionStartedEvent {
  constructor(
    public readonly playerId: string,
    public readonly sessionId: string,
    public readonly strategy: string,
  ) {}
}

export class BotSessionCompletedEvent {
  constructor(
    public readonly playerId: string,
    public readonly sessionId: string,
    public readonly actionsPerformed: number,
    public readonly durationMs: number,
  ) {}
}
