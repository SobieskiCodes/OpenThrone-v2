'use client';

import {
  Container,
  Title,
  Tabs,
  Table,
  Button,
  TextInput,
  NumberInput,
  Stack,
  Alert,
  Text,
  Group,
  Badge,
  Skeleton,
  Paper,
  Switch,
  Accordion,
} from '@mantine/core';
import { OTCard, ActivityFeedItem } from '@/components/ui';
import type { ActivityItem } from '@/components/ui';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { toLocale } from '@openthrone/game-logic';

interface AllianceListItem {
  id: number;
  name: string;
  motto: string | null;
  isPublic: boolean;
  closedEnrollment: boolean;
  goldInBank: string;
  leader: { id: string; display_name: string };
  memberCount: number;
  createdAt: string;
}

interface AllianceMember {
  userId: string;
  player: {
    id: string;
    display_name: string;
    race: string;
    player_class: string;
    last_active: string | null;
  };
  role: {
    id: number;
    name: string;
    permissions: Record<string, boolean>;
  };
  joinedAt: string;
}

interface AllianceDetail {
  id: number;
  name: string;
  motto: string | null;
  isPublic: boolean;
  closedEnrollment: boolean;
  goldInBank: string;
  leader: { id: string; display_name: string };
  createdAt: string;
  members: AllianceMember[];
  roles: { id: number; name: string; permissions: Record<string, boolean> }[];
}

function AllianceActivityFeed({ allianceId }: { allianceId: number }) {
  const { api, isReady } = useApi();
  const { data } = useQuery<{ data: ActivityItem[] }>({
    queryKey: ['activity', 'alliance', allianceId],
    queryFn: () => api.get(`/activity/alliance/${allianceId}?limit=10`),
    enabled: isReady,
  });

  if (!data || data.data.length === 0) return null;

  return (
    <Paper withBorder p="md">
      <Text fw={500} mb="sm">Alliance Activity</Text>
      <Stack gap="xs">
        {data.data.map((item) => (
          <ActivityFeedItem key={item.id} item={item} showPlayerName />
        ))}
      </Stack>
    </Paper>
  );
}

export default function AlliancesPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<string | null>('browse');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [newMotto, setNewMotto] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [newAllowBots, setNewAllowBots] = useState(false);

  // Deposit form (per alliance)
  const [depositAmounts, setDepositAmounts] = useState<Record<number, number | string>>({});

  const { data: alliances, isLoading: loadingList } = useQuery<AllianceListItem[]>({
    queryKey: ['alliances', 'list'],
    queryFn: () => api.get('/alliances'),
    enabled: isReady,
  });

  const { data: myAlliancesData, isLoading: loadingMine } = useQuery<{ alliances: AllianceDetail[] }>({
    queryKey: ['alliances', 'mine'],
    queryFn: () => api.get('/alliances/mine'),
    enabled: isReady,
  });

  const myAlliances = myAlliancesData?.alliances ?? [];
  const myAllianceIds = new Set(myAlliances.map((a) => a.id));
  const hasCreatedAlliance = myAlliances.some((a) =>
    alliances?.some((al) => al.id === a.id && al.leader.id === a.leader.id),
  );
  const canCreateMore = !hasCreatedAlliance;
  const canJoinMore = myAlliances.length < 3;

  const createMutation = useMutation({
    mutationFn: (body: { name: string; motto?: string; isPublic: boolean; allowBots: boolean }) =>
      api.post('/alliances', body),
    onSuccess: () => {
      setError(null);
      setSuccess('Alliance created!');
      setNewName('');
      setNewMotto('');
      setNewIsPublic(true);
      setNewAllowBots(false);
      queryClient.invalidateQueries({ queryKey: ['alliances'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const joinMutation = useMutation({
    mutationFn: (allianceId: number) =>
      api.post(`/alliances/${allianceId}/join`),
    onSuccess: () => {
      setError(null);
      setSuccess('Joined alliance!');
      queryClient.invalidateQueries({ queryKey: ['alliances'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (allianceId: number) =>
      api.post(`/alliances/${allianceId}/leave`),
    onSuccess: () => {
      setError(null);
      setSuccess('Left alliance.');
      queryClient.invalidateQueries({ queryKey: ['alliances'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const depositMutation = useMutation({
    mutationFn: (body: { allianceId: number; amount: string }) =>
      api.post(`/alliances/${body.allianceId}/deposit`, { amount: body.amount }),
    onSuccess: () => {
      setError(null);
      setSuccess('Gold deposited!');
      setDepositAmounts({});
      queryClient.invalidateQueries({ queryKey: ['alliances'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const kickMutation = useMutation({
    mutationFn: (body: { allianceId: number; userId: string }) =>
      api.delete(`/alliances/${body.allianceId}/members/${body.userId}`),
    onSuccess: () => {
      setError(null);
      setSuccess('Member kicked.');
      queryClient.invalidateQueries({ queryKey: ['alliances'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const renderAllianceDetail = (alliance: AllianceDetail) => {
    const depAmount = depositAmounts[alliance.id] ?? 0;
    return (
      <Stack gap="md" key={alliance.id}>
        {/* Alliance info */}
        <OTCard>
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Title order={3}>{alliance.name}</Title>
              {alliance.motto && (
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }} fs="italic">
                  {alliance.motto}
                </Text>
              )}
            </Stack>
            <Stack gap={4} align="flex-end">
              <Text size="sm">
                Treasury:{' '}
                <Text component="span" fw={700} className="ot-stat-value">
                  {toLocale(Number(alliance.goldInBank))}
                </Text>{' '}
                gold
              </Text>
              <Text size="sm">
                Leader:{' '}
                <Text component="span" fw={700}>
                  {alliance.leader.display_name}
                </Text>
              </Text>
            </Stack>
          </Group>
        </OTCard>

        {/* Deposit to treasury */}
        <Paper withBorder p="md">
          <Text fw={500} mb="sm">Deposit to Treasury</Text>
          <Group>
            <NumberInput
              placeholder="Gold amount"
              value={depAmount}
              onChange={(val) =>
                setDepositAmounts((prev) => ({ ...prev, [alliance.id]: val }))
              }
              min={1}
              style={{ flex: 1 }}
            />
            <Button
              onClick={() =>
                depositMutation.mutate({
                  allianceId: alliance.id,
                  amount: String(depAmount),
                })
              }
              loading={depositMutation.isPending}
              disabled={!depAmount || Number(depAmount) <= 0}
            >
              Deposit
            </Button>
          </Group>
        </Paper>

        {/* Members table */}
        <Paper withBorder p="md">
          <Text fw={500} mb="sm">
            Members ({alliance.members.length})
          </Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Player</Table.Th>
                <Table.Th>Race</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th ta="right">Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {alliance.members.map((m) => (
                <Table.Tr key={m.userId}>
                  <Table.Td>
                    <Text fw={500}>{m.player.display_name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">
                      {m.player.race}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={m.role.name === 'Leader' ? 'yellow' : 'gray'}
                      variant="light"
                      size="sm"
                    >
                      {m.role.name}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    {m.userId !== alliance.leader.id && (
                      <Button
                        size="xs"
                        color="red"
                        variant="light"
                        onClick={() =>
                          kickMutation.mutate({
                            allianceId: alliance.id,
                            userId: m.userId,
                          })
                        }
                        loading={kickMutation.isPending}
                      >
                        Kick
                      </Button>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Alliance Activity */}
        <AllianceActivityFeed allianceId={alliance.id} />

        {/* Leave */}
        <Button
          color="red"
          variant="light"
          onClick={() => leaveMutation.mutate(alliance.id)}
          loading={leaveMutation.isPending}
        >
          Leave Alliance
        </Button>
      </Stack>
    );
  };

  return (
    <Container size="md">
      <Stack gap="md">
        <Title order={2}>Alliances</Title>

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
            <Tabs.Tab value="browse">Browse</Tabs.Tab>
            <Tabs.Tab value="mine">
              My Alliances{myAlliances.length > 0 ? ` (${myAlliances.length})` : ''}
            </Tabs.Tab>
            {canCreateMore && <Tabs.Tab value="create">Create</Tabs.Tab>}
          </Tabs.List>

          {/* Browse tab */}
          <Tabs.Panel value="browse" pt="md">
            {loadingList ? (
              <Skeleton height={200} />
            ) : !alliances || alliances.length === 0 ? (
              <Text style={{ color: 'var(--ot-text-dim)' }}>No alliances yet.</Text>
            ) : (
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Leader</Table.Th>
                    <Table.Th ta="center">Members</Table.Th>
                    <Table.Th>Motto</Table.Th>
                    <Table.Th ta="right">Treasury</Table.Th>
                    <Table.Th ta="right">Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {alliances.map((a) => (
                    <Table.Tr key={a.id}>
                      <Table.Td>
                        <Text fw={500}>{a.name}</Text>
                      </Table.Td>
                      <Table.Td>{a.leader.display_name}</Table.Td>
                      <Table.Td ta="center">{a.memberCount}</Table.Td>
                      <Table.Td>
                        <Text size="sm" style={{ color: 'var(--ot-text-dim)' }} lineClamp={1}>
                          {a.motto || '\u2014'}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        {toLocale(Number(a.goldInBank))}
                      </Table.Td>
                      <Table.Td ta="right">
                        {myAllianceIds.has(a.id) ? (
                          <Badge color="blue" size="sm">Joined</Badge>
                        ) : !a.closedEnrollment && canJoinMore ? (
                          <Button
                            size="xs"
                            onClick={() => joinMutation.mutate(a.id)}
                            loading={joinMutation.isPending}
                          >
                            Join
                          </Button>
                        ) : a.closedEnrollment ? (
                          <Badge color="gray" size="sm">Closed</Badge>
                        ) : (
                          <Badge color="gray" size="sm">Max 3</Badge>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          {/* My Alliances tab */}
          <Tabs.Panel value="mine" pt="md">
            {loadingMine ? (
              <Skeleton height={200} />
            ) : myAlliances.length === 0 ? (
              <Text style={{ color: 'var(--ot-text-dim)' }}>You are not in any alliances.</Text>
            ) : myAlliances.length === 1 ? (
              renderAllianceDetail(myAlliances[0]!)
            ) : (
              <Accordion>
                {myAlliances.map((alliance) => (
                  <Accordion.Item key={alliance.id} value={String(alliance.id)}>
                    <Accordion.Control>
                      <Group>
                        <Text fw={500}>{alliance.name}</Text>
                        <Badge size="sm" variant="light">
                          {alliance.members.length} members
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      {renderAllianceDetail(alliance)}
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            )}
          </Tabs.Panel>

          {/* Create tab */}
          {canCreateMore && (
            <Tabs.Panel value="create" pt="md">
              <Paper withBorder p="md">
                <Stack gap="md">
                  <TextInput
                    label="Alliance Name"
                    placeholder="Enter alliance name"
                    value={newName}
                    onChange={(e) => setNewName(e.currentTarget.value)}
                    required
                    minLength={3}
                    maxLength={50}
                  />
                  <TextInput
                    label="Motto"
                    placeholder="Optional motto"
                    value={newMotto}
                    onChange={(e) => setNewMotto(e.currentTarget.value)}
                    maxLength={200}
                  />
                  <Switch
                    label="Public alliance (anyone can join)"
                    checked={newIsPublic}
                    onChange={(e) => setNewIsPublic(e.currentTarget.checked)}
                  />
                  <Switch
                    label="Allow bots to join"
                    description="Bots can auto-join this alliance"
                    checked={newAllowBots}
                    onChange={(e) => setNewAllowBots(e.currentTarget.checked)}
                  />
                  <Button
                    onClick={() =>
                      createMutation.mutate({
                        name: newName,
                        motto: newMotto || undefined,
                        isPublic: newIsPublic,
                        allowBots: newAllowBots,
                      })
                    }
                    loading={createMutation.isPending}
                    disabled={newName.length < 3}
                  >
                    Create Alliance
                  </Button>
                </Stack>
              </Paper>
            </Tabs.Panel>
          )}
        </Tabs>
      </Stack>
    </Container>
  );
}
