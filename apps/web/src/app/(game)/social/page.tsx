'use client';

import {
  Container,
  Title,
  Tabs,
  Table,
  Button,
  TextInput,
  Stack,
  Alert,
  Text,
  Group,
  Badge,
  Skeleton,
  Paper,
} from '@mantine/core';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';

interface OtherPlayer {
  id: string;
  display_name: string;
  race: string;
  player_class: string;
  last_active: string | null;
}

interface Relationship {
  id: number;
  relationshipType: string;
  status: string;
  requestDate: string;
  acceptanceDate: string | null;
  otherPlayer: OtherPlayer;
}

export default function SocialPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<string | null>('FRIEND');
  const [friendName, setFriendName] = useState('');
  const [enemyName, setEnemyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: relationships, isLoading } = useQuery<Relationship[]>({
    queryKey: ['social', tab],
    queryFn: () => api.get(`/social?type=${tab}`),
    enabled: isReady && !!tab,
  });

  const addMutation = useMutation({
    mutationFn: (body: { friendId: string; relationshipType: string }) =>
      api.post('/social/add', body),
    onSuccess: () => {
      setError(null);
      setSuccess('Request sent!');
      setFriendName('');
      setEnemyName('');
      queryClient.invalidateQueries({ queryKey: ['social'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const respondMutation = useMutation({
    mutationFn: (body: { requestId: number; accept: boolean }) =>
      api.post('/social/respond', body),
    onSuccess: () => {
      setError(null);
      setSuccess('Response sent!');
      queryClient.invalidateQueries({ queryKey: ['social'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/social/${id}`),
    onSuccess: () => {
      setError(null);
      setSuccess('Relationship removed.');
      queryClient.invalidateQueries({ queryKey: ['social'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  // We need to look up player by name to get their ID
  const handleAdd = async (name: string, type: string) => {
    setError(null);
    setSuccess(null);
    if (!name.trim()) {
      setError('Enter a player name');
      return;
    }
    try {
      const players = await api.get<{ id: string; display_name: string }[]>(
        `/player/search?q=${encodeURIComponent(name.trim())}`,
      );
      if (!players || players.length === 0) {
        setError('Player not found');
        return;
      }
      const target = players.find(
        (p) => p.display_name.toLowerCase() === name.trim().toLowerCase(),
      );
      if (!target) {
        setError('Player not found');
        return;
      }
      addMutation.mutate({ friendId: target.id, relationshipType: type });
    } catch (err: any) {
      setError(err.message || 'Failed to find player');
    }
  };

  const renderTable = (items: Relationship[], showActions: boolean, isRequests: boolean) => {
    if (items.length === 0) {
      return <Text style={{ color: 'var(--ot-text-dim)' }}>No entries yet.</Text>;
    }

    return (
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Player</Table.Th>
            <Table.Th>Race</Table.Th>
            <Table.Th>Class</Table.Th>
            <Table.Th ta="right">Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((rel) => (
            <Table.Tr key={rel.id}>
              <Table.Td>
                <Text fw={500}>{rel.otherPlayer.display_name}</Text>
              </Table.Td>
              <Table.Td>
                <Badge variant="light" size="sm">
                  {rel.otherPlayer.race}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Badge variant="light" color="gray" size="sm">
                  {rel.otherPlayer.player_class}
                </Badge>
              </Table.Td>
              <Table.Td ta="right">
                {isRequests ? (
                  <Group gap="xs" justify="flex-end">
                    <Button
                      size="xs"
                      color="green"
                      onClick={() =>
                        respondMutation.mutate({ requestId: rel.id, accept: true })
                      }
                      loading={respondMutation.isPending}
                    >
                      Accept
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      variant="light"
                      onClick={() =>
                        respondMutation.mutate({ requestId: rel.id, accept: false })
                      }
                      loading={respondMutation.isPending}
                    >
                      Decline
                    </Button>
                  </Group>
                ) : (
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    onClick={() => removeMutation.mutate(rel.id)}
                    loading={removeMutation.isPending}
                  >
                    Remove
                  </Button>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  };

  return (
    <Container size="md">
      <Stack gap="md">
        <Title order={2}>Social</Title>

        {error && (
          <Alert color="red" onClose={() => setError(null)} withCloseButton>
            {error}
          </Alert>
        )}
        {success && (
          <Alert color="green" onClose={() => setSuccess(null)} withCloseButton>
            {success}
          </Alert>
        )}

        <Tabs
          value={tab}
          onChange={(val) => {
            setTab(val);
            setError(null);
            setSuccess(null);
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="FRIEND">Friends</Tabs.Tab>
            <Tabs.Tab value="ENEMY">Enemies</Tabs.Tab>
            <Tabs.Tab value="REQUESTS">Requests</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="FRIEND" pt="md">
            <Stack gap="md">
              <Paper withBorder p="md" className="ot-card">
                <Group>
                  <TextInput
                    placeholder="Player name"
                    value={friendName}
                    onChange={(e) => setFriendName(e.currentTarget.value)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    onClick={() => handleAdd(friendName, 'FRIEND')}
                    loading={addMutation.isPending}
                  >
                    Add Friend
                  </Button>
                </Group>
              </Paper>
              {isLoading ? (
                <Skeleton height={200} />
              ) : (
                renderTable(relationships ?? [], true, false)
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="ENEMY" pt="md">
            <Stack gap="md">
              <Paper withBorder p="md">
                <Group>
                  <TextInput
                    placeholder="Player name"
                    value={enemyName}
                    onChange={(e) => setEnemyName(e.currentTarget.value)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    color="red"
                    onClick={() => handleAdd(enemyName, 'ENEMY')}
                    loading={addMutation.isPending}
                  >
                    Mark as Enemy
                  </Button>
                </Group>
              </Paper>
              {isLoading ? (
                <Skeleton height={200} />
              ) : (
                renderTable(relationships ?? [], true, false)
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="REQUESTS" pt="md">
            {isLoading ? (
              <Skeleton height={200} />
            ) : (
              renderTable(relationships ?? [], false, true)
            )}
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
