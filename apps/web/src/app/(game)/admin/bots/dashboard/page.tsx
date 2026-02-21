'use client';

import {
  Container,
  Title,
  Stack,
  Group,
  Text,
  Skeleton,
  SegmentedControl,
  SimpleGrid,
  Paper,
  Table,
  Badge,
} from '@mantine/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const STRATEGY_COLORS: Record<string, string> = {
  WARRIOR: '#ff4444',
  TURTLE: '#4c9eff',
  ECONOMIST: '#82ca9d',
  SPYMASTER: '#9b59b6',
  BALANCED: '#f39c12',
};

export default function BotsDashboardPage() {
  const { api, isReady } = useApi();
  const [period, setPeriod] = useState('30d');

  const { data, isLoading } = useQuery<any>({
    queryKey: ['admin', 'bots', 'analytics', 'global', period],
    queryFn: () => {
      const p = new URLSearchParams();
      p.set('period', period);
      return api.get(`/admin/bots/analytics/global?${p.toString()}`);
    },
    enabled: isReady,
    refetchInterval: 5000, // Refresh every 5 seconds to show simulation progress
  });

  // Transform strategy comparison data for charts
  const strategyChartData = data?.strategyComparison
    ? Object.keys(data.strategyComparison).reduce((acc: any[], strategy) => {
        const strategyData = data.strategyComparison[strategy];
        strategyData.forEach((snapshot: any) => {
          let existing = acc.find((d) => d.date === snapshot.date);
          if (!existing) {
            existing = { date: snapshot.date };
            acc.push(existing);
          }
          existing[`${strategy}_gold`] = snapshot.gold;
          existing[`${strategy}_population`] = snapshot.population;
        });
        return acc;
      }, [])
    : [];

  // Transform bot data for overlay chart (top 10 only)
  const topBots = data?.bots
    ? [...data.bots]
        .sort((a: any, b: any) => b.gold - a.gold)
        .slice(0, 10)
    : [];

  const botOverlayData = topBots
    ? topBots.reduce((acc: any[], bot: any) => {
        bot.snapshots.forEach((snapshot: any) => {
          let existing = acc.find((d: any) => d.date === snapshot.date);
          if (!existing) {
            existing = { date: snapshot.date };
            acc.push(existing);
          }
          existing[`${bot.name}_gold`] = snapshot.gold;
        });
        return acc;
      }, [])
    : [];

  return (
    <Container size="xl">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={2}>Bot Analytics Dashboard</Title>
          <SegmentedControl
            data={[
              { label: '7D', value: '7d' },
              { label: '30D', value: '30d' },
              { label: '3M', value: '3m' },
              { label: '6M', value: '6m' },
              { label: '1Y', value: '1y' },
              { label: 'All', value: 'all' },
            ]}
            value={period}
            onChange={setPeriod}
          />
        </Group>

        {isLoading ? (
          <Skeleton height={400} />
        ) : data ? (
          <>
            {/* Summary Cards */}
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <Paper p="md" withBorder>
                <Text size="xs" c="dimmed">Total Bots Active</Text>
                <Text size="xl" fw={700}>{data.summary.totalBots}</Text>
              </Paper>
              <Paper p="md" withBorder>
                <Text size="xs" c="dimmed">Total Gold in Economy</Text>
                <Text size="xl" fw={700} className="ot-stat-value">
                  {data.summary.totalGold.toLocaleString()}
                </Text>
              </Paper>
              <Paper p="md" withBorder>
                <Text size="xs" c="dimmed">Total Population</Text>
                <Text size="xl" fw={700}>
                  {data.summary.totalPopulation.toLocaleString()}
                </Text>
              </Paper>
            </SimpleGrid>

            {/* Strategy Comparison - Gold */}
            <Paper p="md" withBorder>
              <Text size="sm" fw={600} mb="sm">
                Strategy Comparison — Average Gold Over Time
              </Text>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={strategyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-dark-5)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => new Date(val).toLocaleDateString()}
                    stroke="var(--mantine-color-dark-3)"
                  />
                  <YAxis stroke="var(--mantine-color-dark-3)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--mantine-color-dark-7)',
                      border: '1px solid var(--mantine-color-dark-5)',
                    }}
                  />
                  <Legend />
                  {Object.keys(data.strategyComparison).map((strategy) => (
                    <Line
                      key={strategy}
                      type="monotone"
                      dataKey={`${strategy}_gold`}
                      stroke={STRATEGY_COLORS[strategy] || '#888'}
                      strokeWidth={2}
                      name={strategy}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Paper>

            {/* Top 10 Bots Overlay */}
            <Paper p="md" withBorder>
              <Text size="sm" fw={600} mb="sm">
                Top 10 Bots by Gold — Progress Over Time
              </Text>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={botOverlayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-dark-5)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => new Date(val).toLocaleDateString()}
                    stroke="var(--mantine-color-dark-3)"
                  />
                  <YAxis stroke="var(--mantine-color-dark-3)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--mantine-color-dark-7)',
                      border: '1px solid var(--mantine-color-dark-5)',
                    }}
                  />
                  <Legend />
                  {topBots.map((bot: any, idx: number) => (
                    <Line
                      key={bot.id}
                      type="monotone"
                      dataKey={`${bot.name}_gold`}
                      stroke={STRATEGY_COLORS[bot.strategy] || `hsl(${idx * 60}, 70%, 50%)`}
                      strokeWidth={2}
                      name={bot.name}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Paper>

            {/* Top Performers */}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Paper p="md" withBorder>
                <Text size="sm" fw={600} mb="sm">
                  Top Performers by Gold
                </Text>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Rank</Table.Th>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Strategy</Table.Th>
                      <Table.Th ta="right">Gold</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.topPerformers.byGold.map((bot: any, idx: number) => (
                      <Table.Tr key={idx}>
                        <Table.Td>
                          <Text fw={700} c={idx === 0 ? 'yellow' : idx === 1 ? 'gray' : idx === 2 ? 'orange' : undefined}>
                            #{idx + 1}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={600}>{bot.name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            variant="light"
                            color={STRATEGY_COLORS[bot.strategy]}
                          >
                            {bot.strategy}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text className="ot-stat-value">{bot.gold}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>

              <Paper p="md" withBorder>
                <Text size="sm" fw={600} mb="sm">
                  Top Performers by Level
                </Text>
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Rank</Table.Th>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Strategy</Table.Th>
                      <Table.Th ta="right">Level</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.topPerformers.byLevel.map((bot: any, idx: number) => (
                      <Table.Tr key={idx}>
                        <Table.Td>
                          <Text fw={700} c={idx === 0 ? 'yellow' : idx === 1 ? 'gray' : idx === 2 ? 'orange' : undefined}>
                            #{idx + 1}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={600}>{bot.name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            size="xs"
                            variant="light"
                            color={STRATEGY_COLORS[bot.strategy]}
                          >
                            {bot.strategy}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fw={600}>{bot.level}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </SimpleGrid>
          </>
        ) : (
          <Text c="dimmed" ta="center" py="xl">
            No analytics data available.
          </Text>
        )}
      </Stack>
    </Container>
  );
}
