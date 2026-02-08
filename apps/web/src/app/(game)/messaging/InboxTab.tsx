'use client';

import {
  Stack,
  Table,
  Button,
  TextInput,
  Text,
  Group,
  Badge,
  Skeleton,
  Paper,
  Pagination,
  Modal,
  Textarea,
  SegmentedControl,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { notifications } from '@mantine/notifications';

interface MailItem {
  id: number;
  subject: string;
  body: string;
  mailType: string;
  sender: { id: string; displayName: string } | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface InboxResponse {
  items: MailItem[];
  total: number;
  page: number;
  unreadCount: number;
}

export default function InboxTab() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [selectedMail, setSelectedMail] = useState<MailItem | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const typeParam = filter === 'ALL' ? '' : `&type=${filter}`;
  const { data, isLoading } = useQuery<InboxResponse>({
    queryKey: ['mail', filter, page],
    queryFn: () => api.get(`/mail?page=${page}${typeParam}`),
    enabled: isReady,
  });

  const markReadMutation = useMutation({
    mutationFn: (mailId: number) => api.patch(`/mail/${mailId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch('/mail/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mail'] });
      notifications.show({ title: 'Done', message: 'All messages marked as read', color: 'green' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (mailId: number) => api.delete(`/mail/${mailId}`),
    onSuccess: () => {
      setSelectedMail(null);
      queryClient.invalidateQueries({ queryKey: ['mail'] });
      notifications.show({ title: 'Deleted', message: 'Mail deleted', color: 'green' });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { recipientId: string; subject: string; body: string }) =>
      api.post('/mail', payload),
    onSuccess: () => {
      setComposeOpen(false);
      setRecipientName('');
      setSubject('');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['mail'] });
      notifications.show({ title: 'Sent', message: 'Mail sent successfully', color: 'green' });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  const handleSend = async () => {
    if (!recipientName.trim() || !subject.trim() || !body.trim()) {
      notifications.show({ title: 'Error', message: 'All fields are required', color: 'red' });
      return;
    }
    try {
      const players = await api.get<{ id: string; display_name: string }[]>(
        `/player/search?q=${encodeURIComponent(recipientName.trim())}`,
      );
      if (!players || players.length === 0) {
        notifications.show({ title: 'Error', message: 'Player not found', color: 'red' });
        return;
      }
      const target = players.find(
        (p) => p.display_name.toLowerCase() === recipientName.trim().toLowerCase(),
      );
      if (!target) {
        notifications.show({ title: 'Error', message: 'Player not found', color: 'red' });
        return;
      }
      sendMutation.mutate({ recipientId: target.id, subject, body });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to find player', color: 'red' });
    }
  };

  const handleRowClick = (mail: MailItem) => {
    setSelectedMail(mail);
    if (!mail.isRead) {
      markReadMutation.mutate(mail.id);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <SegmentedControl
          value={filter}
          onChange={(val) => { setFilter(val); setPage(1); }}
          data={[
            { label: 'All', value: 'ALL' },
            { label: 'System', value: 'SYSTEM' },
            { label: 'Player', value: 'PLAYER' },
            { label: 'Alliance', value: 'ALLIANCE' },
          ]}
        />
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            onClick={() => markAllReadMutation.mutate()}
            loading={markAllReadMutation.isPending}
          >
            Mark All Read
          </Button>
          <Button size="xs" onClick={() => setComposeOpen(true)}>
            Compose
          </Button>
        </Group>
      </Group>

      {isLoading ? (
        <Skeleton height={300} />
      ) : !data || data.items.length === 0 ? (
        <Text style={{ color: 'var(--ot-text-dim)' }}>No messages.</Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 20 }} />
              <Table.Th>From</Table.Th>
              <Table.Th>Subject</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th ta="right">Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.items.map((mail) => (
              <Table.Tr
                key={mail.id}
                style={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(mail)}
              >
                <Table.Td>
                  {!mail.isRead && (
                    <Badge size="xs" circle color="blue" variant="filled">
                      {' '}
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text fw={mail.isRead ? 400 : 700} size="sm">
                    {mail.sender?.displayName ?? 'System'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text fw={mail.isRead ? 400 : 700} size="sm" lineClamp={1}>
                    {mail.subject}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    size="xs"
                    variant="light"
                    color={
                      mail.mailType === 'SYSTEM'
                        ? 'gray'
                        : mail.mailType === 'ALLIANCE'
                          ? 'violet'
                          : 'blue'
                    }
                  >
                    {mail.mailType}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right">
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                    {formatDate(mail.createdAt)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {totalPages > 1 && (
        <Group justify="center">
          <Pagination value={page} onChange={setPage} total={totalPages} />
        </Group>
      )}

      {/* Read Mail Modal */}
      <Modal
        opened={!!selectedMail}
        onClose={() => setSelectedMail(null)}
        title={selectedMail?.subject}
        size="lg"
      >
        {selectedMail && (
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                From: {selectedMail.sender?.displayName ?? 'System'}
              </Text>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                {formatDate(selectedMail.createdAt)}
              </Text>
            </Group>
            <Badge
              size="xs"
              variant="light"
              color={
                selectedMail.mailType === 'SYSTEM'
                  ? 'gray'
                  : selectedMail.mailType === 'ALLIANCE'
                    ? 'violet'
                    : 'blue'
              }
            >
              {selectedMail.mailType}
            </Badge>
            <Paper withBorder p="md" style={{ whiteSpace: 'pre-wrap' }}>
              {selectedMail.body}
            </Paper>
            <Group justify="flex-end">
              <Button
                size="xs"
                color="red"
                variant="light"
                onClick={() => deleteMutation.mutate(selectedMail.id)}
                loading={deleteMutation.isPending}
              >
                Delete
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Compose Modal */}
      <Modal
        opened={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="Compose Mail"
        size="lg"
      >
        <Stack gap="sm">
          <TextInput
            label="Recipient"
            placeholder="Player name"
            value={recipientName}
            onChange={(e) => setRecipientName(e.currentTarget.value)}
          />
          <TextInput
            label="Subject"
            placeholder="Subject"
            maxLength={100}
            value={subject}
            onChange={(e) => setSubject(e.currentTarget.value)}
          />
          <Textarea
            label="Message"
            placeholder="Write your message..."
            minRows={5}
            maxLength={5000}
            value={body}
            onChange={(e) => setBody(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} loading={sendMutation.isPending}>
              Send
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
