import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

export function getChatSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(`${API_URL}/chat`, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  return socket;
}

export function disconnectChatSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
