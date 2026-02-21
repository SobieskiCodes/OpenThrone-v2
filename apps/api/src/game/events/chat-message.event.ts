/**
 * Event emitted when a chat message is sent
 * Gateway broadcasts to all players in that room
 */
export class ChatMessageEvent {
  roomId!: string; // Initialized via constructor
  senderId!: string;
  senderName!: string;
  senderRace!: string;
  message!: string;
  timestamp!: Date;

  constructor(partial: Partial<ChatMessageEvent>) {
    Object.assign(this, partial);
  }
}
