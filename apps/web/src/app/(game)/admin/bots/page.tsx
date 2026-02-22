'use client';

import {
  Container,
  Title,
  Table,
  Badge,
  Text,
  Skeleton,
  Stack,
  Pagination,
  Group,
  Button,
  Select,
  Switch,
  NumberInput,
  Paper,
  Collapse,
  Modal,
  Progress,
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface BotEntry {
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
  lastActive: string | null;
  level: number;
  gold: string;
  notes: string | null;
}

interface PaginatedResponse {
  data: BotEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface BotStats {
  totalBots: number;
  activeBots: number;
  sessionsToday: number;
  schedulerEnabled: boolean;
  isRunning: boolean;
  nextRunAt: string;
}

const STRATEGY_COLORS: Record<string, string> = {
  WARRIOR: 'red',
  TURTLE: 'blue',
  ECONOMIST: 'green',
  SPYMASTER: 'grape',
  BALANCED: 'orange',
};

const STRATEGY_OPTIONS = [
  { value: '', label: 'All Strategies' },
  { value: 'WARRIOR', label: 'Warrior' },
  { value: 'TURTLE', label: 'Turtle' },
  { value: 'ECONOMIST', label: 'Economist' },
  { value: 'SPYMASTER', label: 'Spymaster' },
  { value: 'BALANCED', label: 'Balanced' },
];

export default function BotsPage() {
  const { api, isReady } = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [strategyFilter, setStrategyFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genCount, setGenCount] = useState<number>(10);
  const [genMinLevel, setGenMinLevel] = useState<number>(5);
  const [genMaxLevel, setGenMaxLevel] = useState<number>(60);
  const [showSimulation, setShowSimulation] = useState(false);
  const [simDays, setSimDays] = useState<number>(180);
  const [simSessionsPerDay, setSimSessionsPerDay] = useState<number>(5);

  const buildQuery = () => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '20');
    if (strategyFilter) params.set('strategy', strategyFilter);
    if (activeOnly) params.set('active', 'true');
    return params.toString();
  };

  const { data, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ['admin', 'bots', page, strategyFilter, activeOnly],
    queryFn: () => api.get(`/admin/bots?${buildQuery()}`),
    enabled: isReady,
  });

  const { data: stats } = useQuery<BotStats>({
    queryKey: ['admin', 'bots', 'stats'],
    queryFn: () => api.get('/admin/bots/stats'),
    enabled: isReady,
    refetchInterval: 60_000,
  });

  const runAllMutation = useMutation({
    mutationFn: () => api.post('/admin/bots/run-all', {}),
    onSuccess: (result: any) => {
      notifications.show({
        title: 'Bots Run',
        message: `${result.botsRun} bots ran, ${result.totalActions} total actions`,
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'bots'] });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/bots/generate', {
        count: genCount,
        minLevel: genMinLevel,
        maxLevel: genMaxLevel,
      }),
    onSuccess: (result: any) => {
      notifications.show({
        title: 'Bots Generated',
        message: `Created ${result.created} bots (levels ${genMinLevel}-${genMaxLevel})`,
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'bots'] });
      setShowGenerate(false);
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  // Simulation status polling
  const { data: simStatus } = useQuery<any>({
    queryKey: ['admin', 'bots', 'simulation', 'status'],
    queryFn: () => api.get('/admin/bots/simulation/status'),
    enabled: isReady && showSimulation,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' ? 1000 : false; // Poll every 1s while running
    },
  });

  const startSimulationMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/bots/simulation/start', {
        days: simDays,
        sessionsPerDay: simSessionsPerDay,
      }),
    onSuccess: () => {
      notifications.show({
        title: 'Simulation Started',
        message: `Running ${simDays} days of simulation...`,
        color: 'blue',
      });
      // Force refetch status to show progress UI
      queryClient.invalidateQueries({ queryKey: ['admin', 'bots', 'simulation', 'status'] });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  const cancelSimulationMutation = useMutation({
    mutationFn: () => api.post('/admin/bots/simulation/cancel', {}),
    onSuccess: () => {
      notifications.show({
        title: 'Cancelling',
        message: 'Simulation will stop after current bot...',
        color: 'orange',
      });
    },
  });

  // Auto-close modal when simulation completes
  useEffect(() => {
    if (simStatus?.status === 'completed' || simStatus?.status === 'cancelled') {
      const timer = setTimeout(() => {
        setShowSimulation(false);
        queryClient.invalidateQueries({ queryKey: ['admin', 'bots'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'bots', 'simulation', 'status'] });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [simStatus?.status, queryClient]);

  return (
    <Container size="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={2}>Bot Management</Title>
          <Group gap="sm">
            <Button
              variant="light"
              color="blue"
              component={Link}
              href="/admin/bots/dashboard"
            >
              📊 Dashboard
            </Button>
            <Button
              variant="light"
              color="violet"
              onClick={() => runAllMutation.mutate()}
              loading={runAllMutation.isPending}
            >
              Run All Bots
            </Button>
            <Button
              variant="light"
              color="teal"
              onClick={() => setShowGenerate((v) => !v)}
            >
              Generate Bots
            </Button>
            <Button
              variant="light"
              color="orange"
              onClick={() => setShowSimulation(true)}
            >
              ⚡ Fast-Forward Simulation
            </Button>
          </Group>
        </Group>

        {stats && (
          <Group gap="lg">
            <Group gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Scheduler:</Text>
              <Badge size="sm" variant="light" color={stats.schedulerEnabled ? 'green' : 'gray'}>
                {stats.schedulerEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
              {stats.isRunning && (
                <Badge size="sm" variant="filled" color="blue">Running Now</Badge>
              )}
            </Group>
            <Group gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Next Run:</Text>
              <Text size="sm" fw={600}>
                {new Date(stats.nextRunAt).toLocaleString()}
              </Text>
            </Group>
            <Group gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Sessions Today:</Text>
              <Text size="sm" fw={600}>{stats.sessionsToday}</Text>
            </Group>
          </Group>
        )}

        {/* Simulation Status Banner */}
        {simStatus?.status === 'running' && (
          <Paper p="md" withBorder style={{ backgroundColor: 'var(--mantine-color-blue-9)' }}>
            <Group justify="space-between" align="center">
              <Group gap="md">
                <Badge size="lg" variant="filled" color="blue">
                  SIMULATION RUNNING
                </Badge>
                <Text size="sm" fw={600}>
                  Day {simStatus.currentDay}/{simStatus.totalDays} • Bot {simStatus.currentBot}/{simStatus.totalBots}
                </Text>
                <Text size="sm" c="dimmed">
                  {simStatus.totalActions.toLocaleString()} actions • {((Date.now() - simStatus.startTime) / 1000).toFixed(0)}s elapsed
                </Text>
              </Group>
              <Group gap="sm">
                <Button
                  variant="light"
                  color="white"
                  size="sm"
                  onClick={() => setShowSimulation(true)}
                >
                  View Progress
                </Button>
                <Button
                  variant="filled"
                  color="red"
                  size="sm"
                  onClick={() => cancelSimulationMutation.mutate()}
                  loading={cancelSimulationMutation.isPending}
                >
                  ⏹ Stop Simulation
                </Button>
              </Group>
            </Group>
          </Paper>
        )}

        <Collapse in={showGenerate}>
          <Paper p="md" withBorder>
            <Stack gap="sm">
              <Text fw={600}>Generate Multiple Bots</Text>
              <Text size="sm" c="dimmed">
                Creates bots with random names, races, classes, strategies, and level-scaled
                progression (units, items, structures, fortifications).
              </Text>
              <Group gap="md">
                <NumberInput
                  label="Count"
                  value={genCount}
                  onChange={(val) => setGenCount(Number(val) || 10)}
                  min={1}
                  max={50}
                  w={100}
                />
                <NumberInput
                  label="Min Level"
                  value={genMinLevel}
                  onChange={(val) => setGenMinLevel(Number(val) || 1)}
                  min={1}
                  max={100}
                  w={120}
                />
                <NumberInput
                  label="Max Level"
                  value={genMaxLevel}
                  onChange={(val) => setGenMaxLevel(Number(val) || 60)}
                  min={1}
                  max={100}
                  w={120}
                />
                <Button
                  color="teal"
                  onClick={() => generateMutation.mutate()}
                  loading={generateMutation.isPending}
                  mt={24}
                >
                  Generate {genCount} Bots
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Collapse>

        <Group gap="sm">
          <Select
            data={STRATEGY_OPTIONS}
            value={strategyFilter}
            onChange={(val) => {
              setStrategyFilter(val ?? '');
              setPage(1);
            }}
            placeholder="Filter by strategy"
            clearable
            w={200}
          />
          <Switch
            label="Active Only"
            checked={activeOnly}
            onChange={(e) => {
              setActiveOnly(e.currentTarget.checked);
              setPage(1);
            }}
          />
        </Group>

        {isLoading ? (
          <Skeleton height={400} />
        ) : (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Race / Class</Table.Th>
                  <Table.Th>Strategy</Table.Th>
                  <Table.Th ta="center">Status</Table.Th>
                  <Table.Th ta="center">Sessions</Table.Th>
                  <Table.Th ta="center">Level</Table.Th>
                  <Table.Th ta="right">Gold</Table.Th>
                  <Table.Th>Last Active</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data?.data.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Text ta="center" style={{ color: 'var(--ot-text-dim)' }} py="xl">
                        No bots found. Create one to get started.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
                {data?.data.map((bot) => (
                  <Table.Tr
                    key={bot.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/admin/bots/${bot.id}`)}
                  >
                    <Table.Td>
                      <Text fw={600} style={{ color: 'var(--ot-gold)' }}>
                        {bot.displayName}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Badge size="xs" variant="light">{bot.race}</Badge>
                        <Badge size="xs" variant="light" color="gray">{bot.class}</Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        variant="light"
                        color={STRATEGY_COLORS[bot.strategy] ?? 'gray'}
                      >
                        {bot.strategy}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge
                        size="sm"
                        variant={bot.isActive ? 'filled' : 'light'}
                        color={bot.isActive ? 'green' : 'gray'}
                      >
                        {bot.isActive ? 'Active' : 'Paused'}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Text size="sm">
                        {bot.sessionsToday}/{bot.sessionsPerDay}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Text size="sm" fw={600}>{bot.level}</Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" className="ot-stat-value">
                        {Number(bot.gold).toLocaleString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                        {bot.lastActive
                          ? new Date(bot.lastActive).toLocaleString()
                          : 'Never'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            {data && data.pagination.totalPages > 1 && (
              <Group justify="center">
                <Pagination
                  total={data.pagination.totalPages}
                  value={page}
                  onChange={setPage}
                />
              </Group>
            )}
          </>
        )}
      </Stack>

      {/* Simulation Modal */}
      <Modal
        opened={showSimulation}
        onClose={() => {
          if (simStatus?.status !== 'running') {
            setShowSimulation(false);
          }
        }}
        title="⚡ Fast-Forward Bot Simulation"
        size="lg"
        closeOnClickOutside={simStatus?.status !== 'running'}
        closeOnEscape={simStatus?.status !== 'running'}
      >
        <Stack gap="md">
          {!simStatus || simStatus.status === 'idle' || simStatus.status === 'completed' || simStatus.status === 'cancelled' ? (
            <>
              <Text size="sm" c="dimmed">
                Run bots through accelerated time to generate months of real gameplay data.
                Each bot will perform {simSessionsPerDay} sessions per simulated day.
              </Text>

              <Divider />

              <Group gap="md">
                <NumberInput
                  label="Days to Simulate"
                  description="180 days = 6 months"
                  value={simDays}
                  onChange={(val) => {
                    if (val === '' || val === undefined) return;
                    const num = Number(val);
                    if (!isNaN(num) && num >= 1 && num <= 365) {
                      setSimDays(num);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !startSimulationMutation.isPending) {
                      startSimulationMutation.mutate();
                    }
                  }}
                  min={1}
                  max={365}
                  w={150}
                  clampBehavior="strict"
                  allowNegative={false}
                  allowDecimal={false}
                />
                <NumberInput
                  label="Sessions per Day"
                  description="How many times each bot runs daily"
                  value={simSessionsPerDay}
                  onChange={(val) => {
                    if (val === '' || val === undefined) return;
                    const num = Number(val);
                    if (!isNaN(num) && num >= 1 && num <= 10) {
                      setSimSessionsPerDay(num);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !startSimulationMutation.isPending) {
                      startSimulationMutation.mutate();
                    }
                  }}
                  min={1}
                  max={10}
                  w={150}
                  clampBehavior="strict"
                  allowNegative={false}
                  allowDecimal={false}
                />
              </Group>

              <Divider />

              <Text size="xs" c="dimmed">
                • Simulation runs in the background (won't freeze your browser)
                • Progress updates every second
                • Can be cancelled at any time
                • All bots will be reset before simulation starts
              </Text>

              <Button
                fullWidth
                color="orange"
                size="lg"
                onClick={() => startSimulationMutation.mutate()}
                loading={startSimulationMutation.isPending}
              >
                Start Simulation ({simDays} days, {simSessionsPerDay} sessions/day)
              </Button>
            </>
          ) : (
            <>
              <Badge
                size="lg"
                variant="filled"
                color={
                  simStatus.status === 'running'
                    ? 'blue'
                    : simStatus.status === 'completed'
                      ? 'green'
                      : simStatus.status === 'cancelled'
                        ? 'orange'
                        : 'red'
                }
              >
                {simStatus.status.toUpperCase()}
              </Badge>

              {simStatus.status === 'running' && (
                <>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>
                        Day {simStatus.currentDay} / {simStatus.totalDays}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {((simStatus.currentDay / simStatus.totalDays) * 100).toFixed(1)}%
                      </Text>
                    </Group>
                    <Progress
                      value={(simStatus.currentDay / simStatus.totalDays) * 100}
                      size="lg"
                      color="blue"
                      animated
                    />
                  </Stack>

                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>
                        Bot {simStatus.currentBot} / {simStatus.totalBots}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {((simStatus.currentBot / simStatus.totalBots) * 100).toFixed(1)}%
                      </Text>
                    </Group>
                    <Progress
                      value={(simStatus.currentBot / simStatus.totalBots) * 100}
                      size="md"
                      color="teal"
                    />
                  </Stack>

                  <Divider />

                  <Group justify="space-between">
                    <div>
                      <Text size="xs" c="dimmed">
                        Total Actions
                      </Text>
                      <Text size="lg" fw={700}>
                        {simStatus.totalActions.toLocaleString()}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed" ta="right">
                        Elapsed
                      </Text>
                      <Text size="lg" fw={700} ta="right">
                        {((Date.now() - simStatus.startTime) / 1000).toFixed(1)}s
                      </Text>
                    </div>
                  </Group>

                  <Button
                    fullWidth
                    variant="light"
                    color="orange"
                    onClick={() => cancelSimulationMutation.mutate()}
                    loading={cancelSimulationMutation.isPending}
                  >
                    Cancel Simulation
                  </Button>
                </>
              )}

              {simStatus.status === 'completed' && (
                <>
                  <Text size="sm" c="green">
                    ✅ Simulation complete! {simStatus.totalActions.toLocaleString()} total actions
                    in {((Date.now() - simStatus.startTime) / 1000).toFixed(1)}s
                  </Text>
                  <Text size="xs" c="dimmed">
                    Closing in 3 seconds...
                  </Text>
                </>
              )}

              {simStatus.status === 'cancelled' && (
                <>
                  <Text size="sm" c="orange">
                    ⚠️ Simulation cancelled at day {simStatus.currentDay}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Closing in 3 seconds...
                  </Text>
                </>
              )}

              {simStatus.status === 'error' && (
                <>
                  <Text size="sm" c="red">
                    ❌ Simulation failed: {simStatus.error}
                  </Text>
                  <Button
                    fullWidth
                    variant="light"
                    onClick={() => setShowSimulation(false)}
                  >
                    Close
                  </Button>
                </>
              )}
            </>
          )}
        </Stack>
      </Modal>
    </Container>
  );
}
