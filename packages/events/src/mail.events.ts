export class MailSentEvent {
  constructor(
    public readonly mailId: number,
    public readonly senderId: string | null,
    public readonly recipientIds: string[],
    public readonly mailType: string,
  ) {}
}

export class MailReadEvent {
  constructor(
    public readonly mailId: number,
    public readonly recipientId: string,
  ) {}
}
