'use client';

import {
  Title,
  Card,
  Grid,
  Text,
  Stack,
  Tabs,
  Table,
  Badge,
  Button,
  Group,
  TextInput,
  NumberInput,
  Select,
  Loader,
  Center,
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';

interface PlayerDetail {
  id: string;
  displayName: string;
  email: string;
  race: string;
  class: string;
  status: string;
  bio: string;
  lastActive: string | null;
  createdAt: string;
  economy: {
    gold: string;
    goldInBank: string;
    attackTurns: number;
  } | null;
  stats: {
    experience: number;
    rank: number;
    offense: number;
    defense: number;
    spy: number;
    sentry: number;
  } | null;
  units: { unitType: string; level: number; quantity: number }[];
  items: { itemType: string; usage: string; level: number; quantity: number }[];
  fortification: { fortLevel: number; hitpoints: number } | null;
  bonusPoints: { bonusType: string; level: number }[];
  permissions: string[];
  statusHistory: {
    id: number;
    status: string;
    startDate: string;
    endDate: string | null;
    reason: string | null;
    adminId: string | null;
  }[];
}

const ACTION_OPTIONS = [
  { value: 'BAN', label: 'Ban' },
  { value: 'SUSPEND', label: 'Suspend' },
  { value: 'TIMEOUT', label: 'Timeout' },
  { value: 'ACTIVATE', label: 'Activate' },
  { value: 'CLOSE', label: 'Close Account' },
  { value: 'VACATION', label: 'Set Vacation' },
];

export default function AdminPlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params.id as string;
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [editGold, setEditGold] = useState('');
  const [editTurns, setEditTurns] = useState<number | string>('');
  const [editXP, setEditXP] = useState<number | string>('');
  const [action, setAction] = useState<string | null>(null);
  const [actionDuration, setActionDuration] = useState<number | string>('');
  const [actionReason, setActionReason] = useState('');
  const [editBonusPoints, setEditBonusPoints] = useState<Record<string, number | string>>({});
  const [editStats, setEditStats] = useState<Record<string, number | string>>({});

  const { data: player, isLoading } = useQuery<PlayerDetail>({
    queryKey: ['admin', 'player', playerId],
    queryFn: () => api.get(`/admin/players/${playerId}`),
    enabled: isReady && !!playerId,
  });

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      api.patch(`/admin/players/${playerId}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'player', playerId],
      });
      notifications.show({
        title: 'Updated',
        message: 'Player updated successfully',
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Error',
        message: err.message,
        color: 'red',
      });
    },
  });

  const actionMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      api.post(`/admin/players/${playerId}/account-action`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'player', playerId],
      });
      setAction(null);
      setActionDuration('');
      setActionReason('');
      notifications.show({
        title: 'Action Applied',
        message: 'Account action applied successfully',
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Error',
        message: err.message,
        color: 'red',
      });
    },
  });

  const permissionMutation = useMutation({
    mutationFn: (body: { action: 'grant' | 'revoke'; type: string }) => {
      if (body.action === 'grant') {
        return api.post('/admin/permissions', {
          playerId,
          permissionType: body.type,
        });
      }
      return api.delete(`/admin/permissions/${playerId}/${body.type}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'player', playerId],
      });
      notifications.show({
        title: 'Permissions Updated',
        message: 'Permission updated',
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Error',
        message: err.message,
        color: 'red',
      });
    },
  });

  if (isLoading) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  if (!player) {
    return <Text>Player not found</Text>;
  }

  const isAdmin = player.permissions.includes('ADMINISTRATOR');

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{player.displayName}</Title>
        <Button variant="subtle" onClick={() => router.push('/admin/players')}>
          Back to Players
        </Button>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder>
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Email</Text>
              <Text>{player.email}</Text>
              <Text size="sm" c="dimmed">Race / Class</Text>
              <Text>{player.race} / {player.class}</Text>
              <Text size="sm" c="dimmed">Status</Text>
              <Badge
                color={
                  player.status === 'ACTIVE'
                    ? 'green'
                    : player.status === 'BANNED'
                      ? 'red'
                      : 'gray'
                }
              >
                {player.status}
              </Badge>
              <Text size="sm" c="dimmed">Last Active</Text>
              <Text>
                {player.lastActive
                  ? new Date(player.lastActive).toLocaleString()
                  : 'Never'}
              </Text>
              <Text size="sm" c="dimmed">Created</Text>
              <Text>{new Date(player.createdAt).toLocaleDateString()}</Text>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Tabs defaultValue="economy">
            <Tabs.List>
              <Tabs.Tab value="economy">Economy</Tabs.Tab>
              <Tabs.Tab value="military">Military</Tabs.Tab>
              <Tabs.Tab value="permissions">Permissions</Tabs.Tab>
              <Tabs.Tab value="actions">Actions</Tabs.Tab>
              <Tabs.Tab value="history">Status History</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="economy" pt="md">
              <Stack gap="md">
                <Grid>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Gold on Hand</Text>
                    <Text fw={700}>{player.economy ? BigInt(player.economy.gold).toLocaleString() : '0'}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Gold in Bank</Text>
                    <Text fw={700}>{player.economy ? BigInt(player.economy.goldInBank).toLocaleString() : '0'}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Attack Turns</Text>
                    <Text fw={700}>{player.economy?.attackTurns ?? 0}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Rank</Text>
                    <Text fw={700}>#{player.stats?.rank ?? '-'}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Experience</Text>
                    <Text fw={700}>{player.stats?.experience ?? 0}</Text>
                  </Grid.Col>
                </Grid>

                <Title order={4}>Edit Economy</Title>
                <Group>
                  <TextInput
                    label="Gold"
                    placeholder="New gold amount"
                    value={editGold}
                    onChange={(e) => setEditGold(e.currentTarget.value)}
                    style={{ width: 200 }}
                  />
                  <Button
                    mt="xl"
                    size="xs"
                    disabled={!editGold}
                    loading={updateMutation.isPending}
                    onClick={() => {
                      updateMutation.mutate({ gold: editGold });
                      setEditGold('');
                    }}
                  >
                    Set Gold
                  </Button>
                </Group>
                <Group>
                  <NumberInput
                    label="Attack Turns"
                    placeholder="New turns"
                    value={editTurns}
                    onChange={setEditTurns}
                    min={0}
                    style={{ width: 200 }}
                  />
                  <Button
                    mt="xl"
                    size="xs"
                    disabled={editTurns === ''}
                    loading={updateMutation.isPending}
                    onClick={() => {
                      updateMutation.mutate({ attackTurns: Number(editTurns) });
                      setEditTurns('');
                    }}
                  >
                    Set Turns
                  </Button>
                </Group>
                <Group>
                  <NumberInput
                    label="Experience"
                    placeholder="New XP"
                    value={editXP}
                    onChange={setEditXP}
                    min={0}
                    style={{ width: 200 }}
                  />
                  <Button
                    mt="xl"
                    size="xs"
                    disabled={editXP === ''}
                    loading={updateMutation.isPending}
                    onClick={() => {
                      updateMutation.mutate({ experience: Number(editXP) });
                      setEditXP('');
                    }}
                  >
                    Set XP
                  </Button>
                </Group>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="military" pt="md">
              <Stack gap="md">
                <Title order={4}>Units</Title>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Level</Table.Th>
                      <Table.Th>Quantity</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {player.units.map((u, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{u.unitType}</Table.Td>
                        <Table.Td>{u.level}</Table.Td>
                        <Table.Td>{u.quantity.toLocaleString()}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                <Title order={4}>Stats</Title>
                <Grid>
                  {(['offense', 'defense', 'spy', 'sentry'] as const).map((stat) => (
                    <Grid.Col span={3} key={stat}>
                      <NumberInput
                        label={stat.charAt(0).toUpperCase() + stat.slice(1)}
                        value={editStats[stat] ?? player.stats?.[stat] ?? 0}
                        onChange={(val) => setEditStats((prev) => ({ ...prev, [stat]: val }))}
                        min={0}
                      />
                    </Grid.Col>
                  ))}
                </Grid>
                <Button
                  size="xs"
                  loading={updateMutation.isPending}
                  style={{ width: 'fit-content' }}
                  disabled={Object.keys(editStats).length === 0}
                  onClick={() => {
                    const statsPayload: Record<string, number> = {};
                    for (const [stat, val] of Object.entries(editStats)) {
                      if (val !== '' && val !== undefined) {
                        statsPayload[stat] = Number(val);
                      }
                    }
                    if (Object.keys(statsPayload).length > 0) {
                      updateMutation.mutate(statsPayload);
                      setEditStats({});
                    }
                  }}
                >
                  Set Stats
                </Button>

                <Title order={4}>Fortification</Title>
                <Text>
                  Level {player.fortification?.fortLevel ?? 1} — HP:{' '}
                  {player.fortification?.hitpoints ?? 0}
                </Text>

                <Title order={4}>Bonus Points</Title>
                <Grid>
                  {['OFFENSE', 'DEFENSE', 'INTEL', 'INCOME', 'PRICES', 'RECRUITING', 'CASUALTY'].map((type) => {
                    const current = player.bonusPoints.find((bp) => bp.bonusType === type)?.level ?? 0;
                    return (
                      <Grid.Col span={4} key={type}>
                        <NumberInput
                          label={type.charAt(0) + type.slice(1).toLowerCase()}
                          value={editBonusPoints[type] ?? current}
                          onChange={(val) => setEditBonusPoints((prev) => ({ ...prev, [type]: val }))}
                          min={0}
                          max={75}
                        />
                      </Grid.Col>
                    );
                  })}
                </Grid>
                <Button
                  size="xs"
                  loading={updateMutation.isPending}
                  style={{ width: 'fit-content' }}
                  onClick={() => {
                    const bonusPoints: Record<string, number> = {};
                    for (const [type, val] of Object.entries(editBonusPoints)) {
                      if (val !== '' && val !== undefined) {
                        bonusPoints[type] = Number(val);
                      }
                    }
                    if (Object.keys(bonusPoints).length > 0) {
                      updateMutation.mutate({ bonusPoints });
                      setEditBonusPoints({});
                    }
                  }}
                >
                  Set Bonus Points
                </Button>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="permissions" pt="md">
              <Stack gap="md">
                <Text>
                  Current permissions:{' '}
                  {player.permissions.length > 0
                    ? player.permissions.join(', ')
                    : 'None'}
                </Text>
                <Group>
                  {isAdmin ? (
                    <Button
                      color="red"
                      size="xs"
                      loading={permissionMutation.isPending}
                      onClick={() =>
                        permissionMutation.mutate({
                          action: 'revoke',
                          type: 'ADMINISTRATOR',
                        })
                      }
                    >
                      Revoke Admin
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      loading={permissionMutation.isPending}
                      onClick={() =>
                        permissionMutation.mutate({
                          action: 'grant',
                          type: 'ADMINISTRATOR',
                        })
                      }
                    >
                      Grant Admin
                    </Button>
                  )}
                  {player.permissions.includes('MODERATOR') ? (
                    <Button
                      color="red"
                      size="xs"
                      loading={permissionMutation.isPending}
                      onClick={() =>
                        permissionMutation.mutate({
                          action: 'revoke',
                          type: 'MODERATOR',
                        })
                      }
                    >
                      Revoke Moderator
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      loading={permissionMutation.isPending}
                      onClick={() =>
                        permissionMutation.mutate({
                          action: 'grant',
                          type: 'MODERATOR',
                        })
                      }
                    >
                      Grant Moderator
                    </Button>
                  )}
                </Group>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="actions" pt="md">
              <Stack gap="md">
                <Select
                  label="Account Action"
                  data={ACTION_OPTIONS}
                  value={action}
                  onChange={setAction}
                  placeholder="Select action"
                  clearable
                  style={{ maxWidth: 250 }}
                />
                {action &&
                  ['BAN', 'SUSPEND', 'TIMEOUT', 'VACATION'].includes(
                    action,
                  ) && (
                    <NumberInput
                      label="Duration (days)"
                      placeholder="Leave empty for permanent"
                      value={actionDuration}
                      onChange={setActionDuration}
                      min={1}
                      style={{ maxWidth: 250 }}
                    />
                  )}
                <TextInput
                  label="Reason"
                  placeholder="Optional reason"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.currentTarget.value)}
                  style={{ maxWidth: 400 }}
                />
                <Button
                  disabled={!action}
                  color={
                    action === 'ACTIVATE'
                      ? 'green'
                      : action === 'BAN'
                        ? 'red'
                        : 'orange'
                  }
                  loading={actionMutation.isPending}
                  onClick={() => {
                    if (!action) return;
                    const body: Record<string, any> = { action };
                    if (actionDuration) body.duration = Number(actionDuration);
                    if (actionReason) body.reason = actionReason;
                    actionMutation.mutate(body);
                  }}
                  style={{ width: 'fit-content' }}
                >
                  Apply Action
                </Button>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="history" pt="md">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Start</Table.Th>
                    <Table.Th>End</Table.Th>
                    <Table.Th>Reason</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {player.statusHistory.map((sh) => (
                    <Table.Tr key={sh.id}>
                      <Table.Td>
                        <Badge size="sm">{sh.status}</Badge>
                      </Table.Td>
                      <Table.Td>
                        {new Date(sh.startDate).toLocaleString()}
                      </Table.Td>
                      <Table.Td>
                        {sh.endDate
                          ? new Date(sh.endDate).toLocaleString()
                          : 'Current'}
                      </Table.Td>
                      <Table.Td>{sh.reason ?? '-'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>
          </Tabs>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
