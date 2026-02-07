export class FriendRequestSentEvent {
  constructor(
    public readonly fromPlayerId: string,
    public readonly toPlayerId: string,
    public readonly relationshipType: string,
  ) {}
}

export class FriendRequestAcceptedEvent {
  constructor(
    public readonly fromPlayerId: string,
    public readonly toPlayerId: string,
  ) {}
}

export class AllianceCreatedEvent {
  constructor(
    public readonly allianceId: number,
    public readonly leaderId: string,
    public readonly name: string,
  ) {}
}

export class AllianceJoinedEvent {
  constructor(
    public readonly allianceId: number,
    public readonly playerId: string,
  ) {}
}

export class AllianceLeftEvent {
  constructor(
    public readonly allianceId: number,
    public readonly playerId: string,
  ) {}
}

export class MessageSentEvent {
  constructor(
    public readonly roomId: number,
    public readonly senderId: string,
    public readonly messageId: number,
  ) {}
}

export class ReactionAddedEvent {
  constructor(
    public readonly messageId: number,
    public readonly userId: string,
    public readonly reaction: string,
  ) {}
}
