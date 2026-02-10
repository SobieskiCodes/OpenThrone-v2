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
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
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

  return (
    <Container size="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={2}>Bot Management</Title>
          <Group gap="sm">
            <Button
              variant="light"
              color="violet"
              onClick={() => runAllMutation.mutate()}
              loading={runAllMutation.isPending}
            >
              Run All Bots
            </Button>
            <Button
              component={Link}
              href="/admin/bots/create"
            >
              Create Bot
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
    </Container>
  );
}
