import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { usePlayerStore } from '@/stores/player-store';

/**
 * WebSocket hook for real-time game state synchronization
 *
 * Features:
 * - Connects to game WebSocket on login
 * - Listens for state updates and merges into Zustand store
 * - Handles chat messages
 * - Auto-reconnects on disconnect
 * - Multi-tab sync (all tabs receive same updates)
 */

let socket: Socket | null = null;

export function useGameSync() {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only connect if we have a token
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        socket = null;
      }
      return;
    }

    // Don't reconnect if already connected
    if (socketRef.current?.connected) {
      return;
    }

    // Connect to game namespace
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const newSocket = io(`${apiUrl}/game`, {
      auth: { token },
      transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = newSocket;
    socket = newSocket;

    // ─── Connection Events ───────────────────────────────────────────

    newSocket.on('connect', () => {
      console.log('🎮 Game WebSocket connected');
    });

    newSocket.on('connected', (data) => {
      console.log('✅ WebSocket authenticated:', data.message);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🎮 Game WebSocket disconnected:', reason);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
    });

    // ─── Player State Updates ────────────────────────────────────────

    newSocket.on('state:update', (delta: any) => {
      console.log('📡 State update received:', delta);

      // Merge server delta into Zustand store
      const updates: any = {};

      if (delta.gold !== undefined) updates.gold = delta.gold;
      if (delta.goldInBank !== undefined) updates.goldInBank = delta.goldInBank;
      if (delta.level !== undefined) updates.level = delta.level;
      if (delta.experience !== undefined) updates.experience = delta.experience;
      if (delta.attackTurns !== undefined) updates.attackTurns = delta.attackTurns;
      if (delta.totalUnits !== undefined) updates.totalUnits = delta.totalUnits;
      if (delta.unitsByType !== undefined) updates.unitsByType = delta.unitsByType;
      if (delta.availablePoints !== undefined) updates.availablePoints = delta.availablePoints;
      if (delta.buildings !== undefined) updates.buildings = delta.buildings;
      if (delta.availableUpgrades !== undefined) updates.availableUpgrades = delta.availableUpgrades;
      if (delta.unreadMail !== undefined) updates.unreadMail = delta.unreadMail;

      usePlayerStore.getState().setState(updates);
    });

    // ─── Chat Events ─────────────────────────────────────────────────

    newSocket.on('chat:message', (msg: any) => {
      console.log('💬 Chat message received:', msg);
      // TODO: Add to chat store/UI
    });

    // ─── Activity Feed Events ────────────────────────────────────────

    newSocket.on('activity:new', (activity: any) => {
      console.log('📰 New activity:', activity);
      // TODO: Add to live activity feed
    });

    // ─── Cleanup ─────────────────────────────────────────────────────

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        socket = null;
      }
    };
  }, [token]);

  return socketRef.current;
}

/**
 * Get the current game socket (for sending messages)
 */
export function getGameSocket(): Socket | null {
  return socket;
}

/**
 * Send a chat message
 */
export function sendChatMessage(roomId: string, message: string) {
  if (!socket) {
    console.warn('Socket not connected');
    return Promise.resolve({ success: false, error: 'Not connected' });
  }

  return new Promise((resolve) => {
    socket!.emit('chat:send', { roomId, message }, (response: any) => {
      resolve(response);
    });
  });
}

/**
 * Join a chat room
 */
export function joinChatRoom(roomId: string) {
  if (!socket) {
    console.warn('Socket not connected');
    return Promise.resolve({ success: false, error: 'Not connected' });
  }

  return new Promise((resolve) => {
    socket!.emit('chat:join', { roomId }, (response: any) => {
      resolve(response);
    });
  });
}

/**
 * Leave a chat room
 */
export function leaveChatRoom(roomId: string) {
  if (!socket) {
    console.warn('Socket not connected');
    return Promise.resolve({ success: false, error: 'Not connected' });
  }

  return new Promise((resolve) => {
    socket!.emit('chat:leave', { roomId }, (response: any) => {
      resolve(response);
    });
  });
}
