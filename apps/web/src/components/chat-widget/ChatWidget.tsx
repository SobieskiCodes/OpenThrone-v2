'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Paper,
  Stack,
  Text,
  TextInput,
  ActionIcon,
  Group,
  ScrollArea,
  Badge,
  Tooltip,
  Collapse,
  Box,
  SegmentedControl,
} from '@mantine/core';
import {
  IconMessageCircle,
  IconX,
  IconSend,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';
import { useSocket } from '@/hooks/use-socket';
import { notifications } from '@mantine/notifications';
import { api } from '@/lib/api-client';

interface ChatMessage {
  id: number;
  content: string;
  messageType: 'TEXT' | 'SYSTEM' | 'GAME_EVENT' | 'PLAYER';
  sender: {
    id: string;
    displayName: string;
  };
  senderColor: string | null;
  senderIcon: string | null;
  sentAt: string;
}

type MessageFilter = 'all' | 'players' | 'system';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState<MessageFilter>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [generalRoomId, setGeneralRoomId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { socket, isConnected } = useSocket('/chat');

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current && isOpen && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, isCollapsed]);

  // WebSocket listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);

      // Increment unread count if widget is closed or collapsed
      if (!isOpen || isCollapsed) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, isOpen, isCollapsed]);

  // Reset unread count when opening/expanding widget
  useEffect(() => {
    if (isOpen && !isCollapsed) {
      setUnreadCount(0);
    }
  }, [isOpen, isCollapsed]);

  // Load initial messages when opening widget for the first time
  useEffect(() => {
    if (isOpen && messages.length === 0 && socket) {
      // Fetch recent messages and general room info
      Promise.all([
        api.get<ChatMessage[]>('/chat/general/messages?limit=50'),
        api.get<{ id: number; name: string }>('/chat/general'),
      ])
        .then(([messagesData, roomData]) => {
          setMessages(messagesData);
          setGeneralRoomId(roomData.id);
        })
        .catch((err) => {
          console.error('Failed to load chat history:', err);
        });
    }
  }, [isOpen, socket, messages.length]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || !socket || !generalRoomId) return;

    socket.emit('sendMessage', {
      roomId: generalRoomId,
      content: inputValue.trim(),
    });

    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredMessages = messages.filter((msg) => {
    if (filter === 'all') return true;
    if (filter === 'players') return msg.messageType === 'TEXT' || msg.messageType === 'PLAYER';
    if (filter === 'system') return msg.messageType === 'SYSTEM' || msg.messageType === 'GAME_EVENT';
    return true;
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'SYSTEM':
        return 'blue';
      case 'GAME_EVENT':
        return 'grape';
      default:
        return undefined;
    }
  };

  if (!isOpen) {
    return (
      <Box
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 1000,
        }}
      >
        <Tooltip label="Open Chat" position="left">
          <ActionIcon
            size="xl"
            radius="xl"
            variant="filled"
            color="var(--ot-color-primary)"
            onClick={() => setIsOpen(true)}
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          >
            <IconMessageCircle size={28} />
            {unreadCount > 0 && (
              <Badge
                size="sm"
                variant="filled"
                color="red"
                style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  minWidth: 20,
                  height: 20,
                  padding: '0 6px',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </ActionIcon>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Paper
      shadow="lg"
      radius="md"
      withBorder
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 380,
        height: isCollapsed ? 'auto' : 500,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Group
        justify="space-between"
        p="sm"
        style={{
          borderBottom: isCollapsed ? 'none' : '1px solid var(--mantine-color-default-border)',
          cursor: 'pointer',
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <Group gap="xs">
          <IconMessageCircle size={20} />
          <Text fw={600} size="sm">
            General Chat
          </Text>
          {!isConnected && (
            <Badge size="xs" color="red" variant="dot">
              Disconnected
            </Badge>
          )}
        </Group>
        <Group gap="xs">
          {unreadCount > 0 && isCollapsed && (
            <Badge size="sm" variant="filled" color="red">
              {unreadCount}
            </Badge>
          )}
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
          >
            {isCollapsed ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            size="sm"
            color="red"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          >
            <IconX size={16} />
          </ActionIcon>
        </Group>
      </Group>

      <Collapse in={!isCollapsed}>
        <Stack gap={0} style={{ height: 'calc(500px - 50px)' }}>
          {/* Filter Controls */}
          <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <SegmentedControl
              size="xs"
              value={filter}
              onChange={(value) => setFilter(value as MessageFilter)}
              data={[
                { label: 'All', value: 'all' },
                { label: 'Players', value: 'players' },
                { label: 'System', value: 'system' },
              ]}
              fullWidth
            />
          </Box>

          {/* Messages */}
          <ScrollArea
            style={{ flex: 1 }}
            viewportRef={scrollRef}
            type="auto"
            offsetScrollbars
          >
            <Stack gap="xs" p="sm">
              {filteredMessages.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  No messages yet. Be the first to say something!
                </Text>
              ) : (
                filteredMessages.map((msg) => (
                  <Box key={msg.id}>
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <Text size="xs" c="dimmed" style={{ minWidth: 40 }}>
                        {formatTime(msg.sentAt)}
                      </Text>
                      <Stack gap={2} style={{ flex: 1 }}>
                        <Group gap={4}>
                          {msg.senderIcon && <span>{msg.senderIcon}</span>}
                          <Text
                            size="sm"
                            fw={600}
                            style={{ color: msg.senderColor || undefined }}
                          >
                            {msg.sender.displayName}
                          </Text>
                          {(msg.messageType === 'SYSTEM' || msg.messageType === 'GAME_EVENT') && (
                            <Badge size="xs" variant="dot" color={getMessageTypeColor(msg.messageType)}>
                              {msg.messageType}
                            </Badge>
                          )}
                        </Group>
                        <Text size="sm" style={{ wordBreak: 'break-word' }}>
                          {msg.content}
                        </Text>
                      </Stack>
                    </Group>
                  </Box>
                ))
              )}
            </Stack>
          </ScrollArea>

          {/* Input */}
          <Box p="sm" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <Group gap="xs" wrap="nowrap">
              <TextInput
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.currentTarget.value)}
                onKeyDown={handleKeyPress}
                style={{ flex: 1 }}
                size="sm"
                disabled={!isConnected}
                autoComplete="new-password"
                name="chat-message"
                data-form-type="other"
                data-lpignore="true"
              />
              <ActionIcon
                variant="filled"
                color="var(--ot-color-primary)"
                size="lg"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || !isConnected}
              >
                <IconSend size={18} />
              </ActionIcon>
            </Group>
          </Box>
        </Stack>
      </Collapse>
    </Paper>
  );
}
