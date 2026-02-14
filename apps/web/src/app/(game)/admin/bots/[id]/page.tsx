'use client';

import {
  Container,
  Title,
  Stack,
  Badge,
  Text,
  Skeleton,
  Group,
  Button,
  Select,
  NumberInput,
  Textarea,
  Switch,
  Table,
  Pagination,
  Tabs,
  SimpleGrid,
  Paper,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { useParams, useRouter } from 'next/navigation';
import { OTCard } from '@/components/ui';
import Link from 'next/link';

interface BotDetail {
  id: number;
  playerId: string;
  displayName: string;
  race: string;
  class: string;
  strategy: string;
  isActive: boolean;
  sessionsPerDay: number;
  sessionsToday: number;
  lastSessionAt: string | null;
  personalitySeed: number;
  notes: string | null;
  createdAt: string;
  player: {
    level: number;
    experience: number;
    offense: number;
    defense: number;
    spy: number;
    sentry: number;
    gold: string;
    goldInBank: string;
    attackTurns: number;
    fortLevel: number;
    fortHP: number;
    fortMaxHP: number;
    population: number;
  };
}

interface LogEntry {
  id: number;
  sessionId: string;
  actionType: string;
  actionData: string;
  resultData: string | null;
  reasoning: string;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
}

interface LogsResponse {
  data: LogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const STRATEGY_OPTIONS = [
  { value: 'WARRIOR', label: 'Warrior' },
  { value: 'TURTLE', label: 'Turtle' },
  { value: 'ECONOMIST', label: 'Economist' },
  { value: 'SPYMASTER', label: 'Spymaster' },
  { value: 'BALANCED', label: 'Balanced' },
];

const STRATEGY_COLORS: Record<string, string> = {
  WARRIOR: 'red',
  TURTLE: 'blue',
  ECONOMIST: 'green',
  SPYMASTER: 'grape',
  BALANCED: 'orange',
};

const ACTION_TYPE_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'SESSION_START', label: 'Session Start' },
  { value: 'SESSION_END', label: 'Session End' },
  { value: 'AUTO_RECRUIT', label: 'Auto Recruit' },
  { value: 'BANK_DEPOSIT', label: 'Bank Deposit' },
  { value: 'TRAIN_UNITS', label: 'Train Units' },
  { value: 'EQUIP_ITEMS', label: 'Equip Items' },
  { value: 'UPGRADE_STRUCTURE', label: 'Upgrade Structure' },
  { value: 'REPAIR_FORT', label: 'Repair Fort' },
  { value: 'ATTACK_PLAYER', label: 'Attack Player' },
  { value: 'SPY_MISSION', label: 'Spy Mission' },
];

// Assign consistent colors to session IDs
function sessionColor(sessionId: string): string {
  const colors = ['blue', 'green', 'orange', 'grape', 'teal', 'pink', 'cyan', 'lime'];
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length]!;
}

export default function BotDetailPage() {
  const { api, isReady } = useApi();
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const botId = params.id as string;

  // Config form state
  const [editStrategy, setEditStrategy] = useState('');
  const [editSessionsPerDay, setEditSessionsPerDay] = useState(3);
  const [editActive, setEditActive] = useState(true);
  const [editNotes, setEditNotes] = useState('');

  // Logs state
  const [logPage, setLogPage] = useState(1);
  const [logFilter, setLogFilter] = useState('');

  const { data: bot, isLoading } = useQuery<BotDetail>({
    queryKey: ['admin', 'bots', botId],
    queryFn: () => api.get(`/admin/bots/${botId}`),
    enabled: isReady,
  });

  useEffect(() => {
    if (bot) {
      setEditStrategy(bot.strategy);
      setEditSessionsPerDay(bot.sessionsPerDay);
      setEditActive(bot.isActive);
      setEditNotes(bot.notes ?? '');
    }
  }, [bot]);

  const { data: logsData, isLoading: logsLoading } = useQuery<LogsResponse>({
    queryKey: ['admin', 'bots', botId, 'logs', logPage, logFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      p.set('page', String(logPage));
      p.set('limit', '25');
      if (logFilter) p.set('actionType', logFilter);
      return api.get(`/admin/bots/${botId}/logs?${p.toString()}`);
    },
    enabled: isReady,
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/admin/bots/${botId}`, {
        strategy: editStrategy,
        sessionsPerDay: editSessionsPerDay,
        isActive: editActive,
        notes: editNotes || undefined,
      }),
    onSuccess: () => {
      notifications.show({ title: 'Updated', message: 'Bot config saved.', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'bots', botId] });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  const runMutation = useMutation({
    mutationFn: () => api.post(`/admin/bots/${botId}/run`, {}),
    onSuccess: (result: any) => {
      notifications.show({
        title: 'Session Complete',
        message: `${result.actionsPerformed} actions performed.`,
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'bots'] });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/bots/${botId}`),
    onSuccess: () => {
      notifications.show({ title: 'Deleted', message: 'Bot deactivated.', color: 'orange' });
      router.push('/admin/bots');
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  if (isLoading || !bot) {
    return (
      <Container size="lg">
        <Skeleton height={400} />
      </Container>
    );
  }

  return (
    <Container size="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Button variant="subtle" size="compact-sm" component={Link} href="/admin/bots">
              &larr; All Bots
            </Button>
            <Title order={2}>{bot.displayName}</Title>
            <Badge
              size="lg"
              variant="light"
              color={STRATEGY_COLORS[bot.strategy] ?? 'gray'}
            >
              {bot.strategy}
            </Badge>
            <Badge
              size="lg"
              variant={bot.isActive ? 'filled' : 'light'}
              color={bot.isActive ? 'green' : 'gray'}
            >
              {bot.isActive ? 'Active' : 'Paused'}
            </Badge>
          </Group>
          <Group gap="sm">
            <Button
              variant="light"
              color="violet"
              onClick={() => runMutation.mutate()}
              loading={runMutation.isPending}
            >
              Run Now
            </Button>
            <Button
              variant="light"
              color="red"
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              Deactivate
            </Button>
          </Group>
        </Group>

        <Tabs defaultValue="config">
          <Tabs.List>
            <Tabs.Tab value="config">Config</Tabs.Tab>
            <Tabs.Tab value="logs">
              Logs
              {logsData && (
                <Badge size="xs" variant="light" ml={4}>
                  {logsData.pagination.total}
                </Badge>
              )}
            </Tabs.Tab>
            <Tabs.Tab value="player">Player</Tabs.Tab>
          </Tabs.List>

          {/* ── Config Tab ────────────────────────────── */}
          <Tabs.Panel value="config" pt="md">
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <OTCard>
                  <Stack gap="xs">
                    <Text size="xs" fw={700} style={{ color: 'var(--ot-text-dim)' }}>
                      STATS
                    </Text>
                    <Group justify="space-between">
                      <Text size="sm">Level</Text>
                      <Text size="sm" fw={600}>{bot.player.level}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Offense</Text>
                      <Text size="sm" fw={600}>{bot.player.offense.toLocaleString()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Defense</Text>
                      <Text size="sm" fw={600}>{bot.player.defense.toLocaleString()}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Spy / Sentry</Text>
                      <Text size="sm" fw={600}>
                        {bot.player.spy.toLocaleString()} / {bot.player.sentry.toLocaleString()}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Gold</Text>
                      <Text size="sm" fw={600} className="ot-stat-value">
                        {Number(bot.player.gold).toLocaleString()}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Banked</Text>
                      <Text size="sm" fw={600}>
                        {Number(bot.player.goldInBank).toLocaleString()}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Attack Turns</Text>
                      <Text size="sm" fw={600}>{bot.player.attackTurns}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Fort</Text>
                      <Text size="sm" fw={600}>
                        Lv {bot.player.fortLevel} ({bot.player.fortHP}/{bot.player.fortMaxHP})
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">Population</Text>
                      <Text size="sm" fw={600}>{bot.player.population}</Text>
                    </Group>
                  </Stack>
                </OTCard>

                <OTCard>
                  <Stack gap="sm">
                    <Text size="xs" fw={700} style={{ color: 'var(--ot-text-dim)' }}>
                      CONFIGURATION
                    </Text>
                    <Select
                      label="Strategy"
                      data={STRATEGY_OPTIONS}
                      value={editStrategy}
                      onChange={(val) => setEditStrategy(val ?? 'BALANCED')}
                    />
                    <NumberInput
                      label="Sessions Per Day"
                      min={1}
                      max={50}
                      value={editSessionsPerDay}
                      onChange={(val) => setEditSessionsPerDay(Number(val) || 3)}
                    />
                    <Switch
                      label="Active"
                      checked={editActive}
                      onChange={(e) => setEditActive(e.currentTarget.checked)}
                    />
                    <Textarea
                      label="Notes"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.currentTarget.value)}
                      maxLength={500}
                    />
                    <Group justify="flex-end">
                      <Button
                        onClick={() => updateMutation.mutate()}
                        loading={updateMutation.isPending}
                      >
                        Save Config
                      </Button>
                    </Group>
                  </Stack>
                </OTCard>
              </SimpleGrid>

              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                Personality Seed: {bot.personalitySeed} | Created: {new Date(bot.createdAt).toLocaleString()}
              </Text>
            </Stack>
          </Tabs.Panel>

          {/* ── Logs Tab ──────────────────────────────── */}
          <Tabs.Panel value="logs" pt="md">
            <Stack gap="sm">
              <Select
                data={ACTION_TYPE_OPTIONS}
                value={logFilter}
                onChange={(val) => {
                  setLogFilter(val ?? '');
                  setLogPage(1);
                }}
                placeholder="Filter by action type"
                clearable
                w={250}
              />

              {logsLoading ? (
                <Skeleton height={300} />
              ) : (
                <>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Time</Table.Th>
                        <Table.Th>Session</Table.Th>
                        <Table.Th>Action</Table.Th>
                        <Table.Th>Reasoning</Table.Th>
                        <Table.Th ta="center">Result</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {logsData?.data.length === 0 && (
                        <Table.Tr>
                          <Table.Td colSpan={5}>
                            <Text ta="center" style={{ color: 'var(--ot-text-dim)' }} py="md">
                              No logs yet. Run the bot to generate logs.
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                      {logsData?.data.map((log) => (
                        <Table.Tr key={log.id}>
                          <Table.Td>
                            <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              size="xs"
                              variant="light"
                              color={sessionColor(log.sessionId)}
                            >
                              {log.sessionId.slice(0, 8)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              size="xs"
                              variant="light"
                              color={
                                log.actionType === 'SESSION_START' ? 'blue' :
                                log.actionType === 'SESSION_END' ? 'gray' :
                                log.actionType === 'ATTACK_PLAYER' ? 'red' :
                                log.actionType === 'SPY_MISSION' ? 'grape' :
                                'teal'
                              }
                            >
                              {log.actionType.replace(/_/g, ' ')}
                            </Badge>
                          </Table.Td>
                          <Table.Td maw={400}>
                            <Text size="xs" lineClamp={2}>
                              {log.reasoning}
                            </Text>
                            {log.errorMessage && (
                              <Text size="xs" style={{ color: 'var(--ot-danger)' }}>
                                {log.errorMessage}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge
                              size="xs"
                              variant="filled"
                              color={log.success ? 'green' : 'red'}
                            >
                              {log.success ? 'OK' : 'FAIL'}
                            </Badge>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>

                  {logsData && logsData.pagination.totalPages > 1 && (
                    <Group justify="center">
                      <Pagination
                        total={logsData.pagination.totalPages}
                        value={logPage}
                        onChange={setLogPage}
                        size="sm"
                      />
                    </Group>
                  )}
                </>
              )}
            </Stack>
          </Tabs.Panel>

          {/* ── Player Tab ────────────────────────────── */}
          <Tabs.Panel value="player" pt="md">
            <Stack gap="md">
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                Full player management is available on the admin players page.
              </Text>
              <Button
                component={Link}
                href={`/admin/players/${bot.playerId}`}
                variant="light"
                w="fit-content"
              >
                View Full Player Profile
              </Button>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
