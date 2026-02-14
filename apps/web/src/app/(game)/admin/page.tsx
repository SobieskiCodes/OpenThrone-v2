'use client';

import {
  Title,
  Grid,
  Card,
  Text,
  Table,
  Badge,
  Button,
  Group,
  Stack,
  Loader,
  Center,
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { notifications } from '@mantine/notifications';

interface ServerStats {
  totalPlayers: number;
  activePlayers: number;
  totalAlliances: number;
  totalGold: string;
  totalUnits: number;
}

interface JobLog {
  id: number;
  job_name: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  players_processed: number;
  error_message: string | null;
}

export default function AdminDashboard() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery<ServerStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/admin/stats'),
    enabled: isReady,
  });

  const { data: jobLogs, isLoading: logsLoading } = useQuery<{
    rows: JobLog[];
  }>({
    queryKey: ['admin', 'jobs', 'recent'],
    queryFn: () => api.get('/scheduler/logs?limit=10'),
    enabled: isReady,
  });

  const turnTickMutation = useMutation({
    mutationFn: () => api.post('/scheduler/turn-tick'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      notifications.show({
        title: 'Turn Tick',
        message: 'Turn tick executed successfully',
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

  const dailyTickMutation = useMutation({
    mutationFn: () => api.post('/scheduler/daily-tick'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      notifications.show({
        title: 'Daily Tick',
        message: 'Daily tick executed successfully',
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

  const resetDatabaseMutation = useMutation({
    mutationFn: () => api.post('/admin/reset-database'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      notifications.show({
        title: 'Database Reset',
        message: 'All data deleted. Generate bots from /admin/bots or run seed manually.',
        color: 'orange',
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

  if (statsLoading) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  const formatGold = (gold: string) => {
    return BigInt(gold).toLocaleString();
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Admin Dashboard</Title>

      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Total Players
            </Text>
            <Text size="xl" fw={700}>
              {stats?.totalPlayers ?? 0}
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Active Players
            </Text>
            <Text size="xl" fw={700}>
              {stats?.activePlayers ?? 0}
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Alliances
            </Text>
            <Text size="xl" fw={700}>
              {stats?.totalAlliances ?? 0}
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Total Gold
            </Text>
            <Text size="xl" fw={700}>
              {stats ? formatGold(stats.totalGold) : '0'}
            </Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">
              Total Units
            </Text>
            <Text size="xl" fw={700}>
              {stats?.totalUnits?.toLocaleString() ?? 0}
            </Text>
          </Card>
        </Grid.Col>
      </Grid>

      <Group>
        <Title order={3}>Quick Actions</Title>
      </Group>
      <Group>
        <Button
          onClick={() => turnTickMutation.mutate()}
          loading={turnTickMutation.isPending}
        >
          Run Turn Tick
        </Button>
        <Button
          onClick={() => dailyTickMutation.mutate()}
          loading={dailyTickMutation.isPending}
        >
          Run Daily Tick
        </Button>
        <Button
          color="red"
          variant="light"
          onClick={() => {
            if (confirm('⚠️ WARNING: This will DELETE ALL DATA! Are you sure?')) {
              resetDatabaseMutation.mutate();
            }
          }}
          loading={resetDatabaseMutation.isPending}
        >
          Reset Database
        </Button>
      </Group>

      <Title order={3}>Recent Jobs</Title>
      {logsLoading ? (
        <Center h={100}>
          <Loader size="sm" />
        </Center>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Job</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Started</Table.Th>
              <Table.Th>Duration</Table.Th>
              <Table.Th>Players</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {jobLogs?.rows?.length ? (
              jobLogs.rows.map((log) => (
                <Table.Tr key={log.id}>
                  <Table.Td>{log.job_name}</Table.Td>
                  <Table.Td>
                    <Badge
                      color={
                        log.status === 'COMPLETED'
                          ? 'green'
                          : log.status === 'RUNNING'
                            ? 'blue'
                            : 'red'
                      }
                      size="sm"
                    >
                      {log.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {new Date(log.started_at).toLocaleString()}
                  </Table.Td>
                  <Table.Td>
                    {log.duration_ms != null ? `${log.duration_ms}ms` : '-'}
                  </Table.Td>
                  <Table.Td>{log.players_processed}</Table.Td>
                </Table.Tr>
              ))
            ) : (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center">
                    No jobs run yet
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
