import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

/**
 * Generic WebSocket hook for connecting to different namespaces
 *
 * @param namespace - The namespace to connect to (e.g., '/chat', '/game')
 * @returns Socket instance and connection status
 */
export function useSocket(namespace: string) {
  const { data: session } = useSession();
  const token = (session as any)?.accessToken;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Only connect if we have a token
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Don't reconnect if already connected
    if (socketRef.current?.connected) {
      return;
    }

    // Connect to specified namespace
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const newSocket = io(`${apiUrl}${namespace}`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log(`🔌 Connected to ${namespace}`);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log(`🔌 Disconnected from ${namespace}:`, reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error(`❌ Connection error on ${namespace}:`, error.message);
      setIsConnected(false);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [token, namespace]);

  return {
    socket: socketRef.current,
    isConnected,
  };
}
