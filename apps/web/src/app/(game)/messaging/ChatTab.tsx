'use client';

import {
  Stack,
  Group,
  Text,
  Paper,
  TextInput,
  Button,
  Badge,
  ScrollArea,
  ActionIcon,
  Modal,
  Skeleton,
  Box,
  Tooltip,
} from '@mantine/core';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useApi } from '@/hooks/use-api';
import { notifications } from '@mantine/notifications';
import { getChatSocket, disconnectChatSocket } from '@/lib/socket';

interface Participant {
  id: string;
  displayName: string;
  role: string;
}

interface LastMessage {
  id: number;
  content: string;
  sender: { id: string; displayName: string };
  sentAt: string;
}

interface ChatRoom {
  id: number;
  name: string;
  isPrivate: boolean;
  role: string;
  participants: Participant[];
  lastMessage: LastMessage | null;
  unreadCount: number;
  updatedAt: string;
}

interface ChatMessage {
  id: number;
  content: string;
  messageType: string;
  sender: { id: string; displayName: string };
  replyTo: {
    id: number;
    content: string;
    sender: { id: string; displayName: string };
  } | null;
  reactions: { reaction: string; user: { id: string; displayName: string } }[];
  readBy: string[];
  sentAt: string;
}

export default function ChatTab() {
  const { api, isReady } = useApi();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatRecipient, setNewChatRecipient] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<ReturnType<typeof getChatSocket> | null>(null);

  const token = (session as any)?.accessToken ?? null;
  const currentPlayerId = (session as any)?.user?.id ?? null;

  // Fetch rooms
  const { data: rooms, isLoading: roomsLoading } = useQuery<ChatRoom[]>({
    queryKey: ['chat', 'rooms'],
    queryFn: () => api.get('/chat/rooms'),
    enabled: isReady,
  });

  // Fetch messages when room is selected
  const { data: initialMessages, isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ['chat', 'messages', selectedRoom],
    queryFn: () => api.get(`/chat/rooms/${selectedRoom}/messages`),
    enabled: isReady && !!selectedRoom,
  });

  // Sync initial messages
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket connection
  useEffect(() => {
    if (!token) return;

    const socket = getChatSocket(token);
    socketRef.current = socket;

    socket.on('newMessage', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
    });

    socket.on('reactionAdded', (data: { messageId: number; playerId: string; reaction: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? {
                ...m,
                reactions: [
                  ...m.reactions,
                  { reaction: data.reaction, user: { id: data.playerId, displayName: '' } },
                ],
              }
            : m,
        ),
      );
    });

    socket.on('reactionRemoved', (data: { messageId: number; playerId: string; reaction: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? {
                ...m,
                reactions: m.reactions.filter(
                  (r) => !(r.reaction === data.reaction && r.user.id === data.playerId),
                ),
              }
            : m,
        ),
      );
    });

    socket.on('messagesRead', (data: { playerId: string; messageIds: number[] }) => {
      setMessages((prev) =>
        prev.map((m) =>
          data.messageIds.includes(m.id)
            ? { ...m, readBy: [...new Set([...m.readBy, data.playerId])] }
            : m,
        ),
      );
    });

    return () => {
      socket.off('newMessage');
      socket.off('reactionAdded');
      socket.off('reactionRemoved');
      socket.off('messagesRead');
    };
  }, [token, queryClient]);

  // Join room when selected
  useEffect(() => {
    if (!socketRef.current || !selectedRoom) return;
    socketRef.current.emit('joinRoom', selectedRoom);
  }, [selectedRoom]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedRoom || !socketRef.current) return;

    socketRef.current.emit('sendMessage', {
      roomId: selectedRoom,
      content: messageInput.trim(),
      replyToId: replyTo?.id,
    });

    setMessageInput('');
    setReplyTo(null);
  };

  const createRoomMutation = useMutation({
    mutationFn: async (recipientName: string) => {
      const players = await api.get<{ id: string; display_name: string }[]>(
        `/player/search?q=${encodeURIComponent(recipientName.trim())}`,
      );
      if (!players || players.length === 0) {
        throw new Error('Player not found');
      }
      const target = players.find(
        (p) => p.display_name.toLowerCase() === recipientName.trim().toLowerCase(),
      );
      if (!target) throw new Error('Player not found');

      return api.post<{ id: number; name: string | null; existing: boolean }>('/chat/rooms', {
        participantIds: [target.id],
        isPrivate: true,
      });
    },
    onSuccess: (data) => {
      setNewChatOpen(false);
      setNewChatRecipient('');
      setSelectedRoom(data.id);
      queryClient.invalidateQueries({ queryKey: ['chat', 'rooms'] });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString();
  };

  return (
    <Group align="flex-start" gap="md" wrap="nowrap" style={{ height: 500 }}>
      {/* Room List */}
      <Paper withBorder p="xs" style={{ width: 260, height: '100%', flexShrink: 0 }}>
        <Stack gap="xs" h="100%">
          <Group justify="space-between">
            <Text fw={600} size="sm">
              Rooms
            </Text>
            <Button size="xs" variant="light" onClick={() => setNewChatOpen(true)}>
              New
            </Button>
          </Group>

          <ScrollArea style={{ flex: 1 }}>
            <Stack gap={2}>
              {roomsLoading ? (
                <Skeleton height={100} />
              ) : !rooms || rooms.length === 0 ? (
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                  No conversations yet.
                </Text>
              ) : (
                rooms.map((room) => (
                  <Paper
                    key={room.id}
                    p="xs"
                    withBorder={selectedRoom === room.id}
                    bg={selectedRoom === room.id ? 'var(--mantine-color-dark-6)' : undefined}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedRoom(room.id)}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="sm" fw={500} lineClamp={1}>
                        {room.name}
                      </Text>
                      {room.unreadCount > 0 && (
                        <Badge size="xs" circle color="red" variant="filled">
                          {room.unreadCount}
                        </Badge>
                      )}
                    </Group>
                    {room.lastMessage && (
                      <Text size="xs" style={{ color: 'var(--ot-text-dim)' }} lineClamp={1}>
                        {room.lastMessage.sender.displayName}: {room.lastMessage.content}
                      </Text>
                    )}
                  </Paper>
                ))
              )}
            </Stack>
          </ScrollArea>
        </Stack>
      </Paper>

      {/* Message Area */}
      <Paper withBorder p="xs" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {!selectedRoom ? (
          <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'var(--ot-text-dim)' }}>Select a conversation</Text>
          </Box>
        ) : (
          <>
            {/* Messages */}
            <ScrollArea style={{ flex: 1 }} mb="xs">
              <Stack gap="xs" p="xs">
                {messagesLoading ? (
                  <Skeleton height={200} />
                ) : messages.length === 0 ? (
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }} ta="center">
                    No messages yet. Say hello!
                  </Text>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender.id === currentPlayerId;
                    return (
                      <Box key={msg.id}>
                        {msg.replyTo && (
                          <Paper p={4} mb={2} bg="var(--mantine-color-dark-7)" radius="sm">
                            <Text size="xs" style={{ color: 'var(--ot-text-dim)' }} lineClamp={1}>
                              Replying to {msg.replyTo.sender.displayName}: {msg.replyTo.content}
                            </Text>
                          </Paper>
                        )}
                        <Group
                          gap="xs"
                          justify={isMe ? 'flex-end' : 'flex-start'}
                          align="flex-end"
                        >
                          <Paper
                            p="xs"
                            radius="md"
                            bg={isMe ? 'var(--mantine-color-blue-8)' : 'var(--mantine-color-dark-5)'}
                            maw="70%"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setReplyTo(msg)}
                          >
                            {!isMe && (
                              <Text size="xs" fw={600} style={{ color: 'var(--ot-text-dim)' }} mb={2}>
                                {msg.sender.displayName}
                              </Text>
                            )}
                            <Text size="sm">{msg.content}</Text>
                            {msg.reactions.length > 0 && (
                              <Group gap={4} mt={4}>
                                {Object.entries(
                                  msg.reactions.reduce<Record<string, number>>((acc, r) => {
                                    acc[r.reaction] = (acc[r.reaction] || 0) + 1;
                                    return acc;
                                  }, {}),
                                ).map(([reaction, count]) => (
                                  <Badge key={reaction} size="xs" variant="light">
                                    {reaction} {count > 1 ? count : ''}
                                  </Badge>
                                ))}
                              </Group>
                            )}
                          </Paper>
                          <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                            {formatTime(msg.sentAt)}
                          </Text>
                        </Group>
                      </Box>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </Stack>
            </ScrollArea>

            {/* Reply indicator */}
            {replyTo && (
              <Paper p={4} mb={4} bg="var(--mantine-color-dark-7)" radius="sm">
                <Group justify="space-between">
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }} lineClamp={1}>
                    Replying to {replyTo.sender.displayName}: {replyTo.content}
                  </Text>
                  <ActionIcon size="xs" variant="subtle" onClick={() => setReplyTo(null)}>
                    X
                  </ActionIcon>
                </Group>
              </Paper>
            )}

            {/* Message Input */}
            <Group gap="xs">
              <TextInput
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                style={{ flex: 1 }}
              />
              <Button onClick={handleSendMessage} disabled={!messageInput.trim()}>
                Send
              </Button>
            </Group>
          </>
        )}
      </Paper>

      {/* New Chat Modal */}
      <Modal
        opened={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        title="New Conversation"
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Player name"
            placeholder="Search for a player..."
            value={newChatRecipient}
            onChange={(e) => setNewChatRecipient(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setNewChatOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createRoomMutation.mutate(newChatRecipient)}
              loading={createRoomMutation.isPending}
              disabled={!newChatRecipient.trim()}
            >
              Start Chat
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Group>
  );
}
