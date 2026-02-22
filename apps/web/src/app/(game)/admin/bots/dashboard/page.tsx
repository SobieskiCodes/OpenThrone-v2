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
  Tabs,
} from '@mantine/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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

const SEVERITY_COLORS = {
  CRITICAL: 'red',
  WARNING: 'yellow',
  GOOD: 'green',
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

  const { data: battleData, isLoading: battleLoading } = useQuery<any>({
    queryKey: ['admin', 'bots', 'analytics', 'battles', period],
    queryFn: () => {
      const p = new URLSearchParams();
      p.set('period', period);
      return api.get(`/admin/bots/analytics/battles?${p.toString()}`);
    },
    enabled: isReady,
  });

  const { data: unitCompData, isLoading: unitCompLoading } = useQuery<any>({
    queryKey: ['admin', 'bots', 'analytics', 'unit-comp', period],
    queryFn: () => {
      const p = new URLSearchParams();
      p.set('period', period);
      return api.get(`/admin/bots/analytics/unit-composition?${p.toString()}`);
    },
    enabled: isReady,
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
    <Container size="xl" py="md">
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

        <Tabs defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab value="overview">Overview</Tabs.Tab>
            <Tabs.Tab value="battles">Battle Analytics</Tabs.Tab>
            <Tabs.Tab value="units">Unit Composition</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            {renderOverviewTab()}
          </Tabs.Panel>

          <Tabs.Panel value="battles" pt="md">
            {renderBattleAnalyticsTab()}
          </Tabs.Panel>

          <Tabs.Panel value="units" pt="md">
            {renderUnitCompositionTab()}
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );

  function renderOverviewTab() {
    if (isLoading) {
      return (
        <Stack gap="lg">
          <Skeleton height={80} radius="md" />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={280} radius="md" />
            ))}
          </SimpleGrid>
        </Stack>
      );
    }

    if (!data) return null;

    return (
      <Stack gap="lg">

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
    );
  }

  function renderBattleAnalyticsTab() {
    if (battleLoading) {
      return <Skeleton height={400} />;
    }

    if (!battleData) {
      return (
        <Text c="dimmed" ta="center" py="xl">
          No battle data available.
        </Text>
      );
    }

    return (
      <Stack gap="lg">
        {/* Strategy Performance Table */}
        <Paper p="md" withBorder>
          <Text size="sm" fw={600} mb="md">
            Strategy Battle Performance
          </Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Strategy</Table.Th>
                <Table.Th ta="right">Attacks/Day</Table.Th>
                <Table.Th ta="right">Win Rate</Table.Th>
                <Table.Th ta="right">Avg Gold/Attack</Table.Th>
                <Table.Th ta="right">Avg Casualties</Table.Th>
                <Table.Th ta="right">Gold Efficiency</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {Object.entries(battleData.byStrategy).map(([strategy, stats]: [string, any]) => (
                <Table.Tr key={strategy}>
                  <Table.Td>
                    <Badge color={STRATEGY_COLORS[strategy]} variant="light">
                      {strategy}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">{stats.attacksPerDay.toFixed(1)}</Table.Td>
                  <Table.Td ta="right">{(stats.winRate * 100).toFixed(0)}%</Table.Td>
                  <Table.Td ta="right">{stats.avgGoldPerAttack.toLocaleString()}</Table.Td>
                  <Table.Td ta="right">{stats.avgCasualties}</Table.Td>
                  <Table.Td ta="right" c={stats.goldEfficiency > 0 ? 'green' : 'red'}>
                    {stats.goldEfficiency > 0 ? '+' : ''}{stats.goldEfficiency.toLocaleString()}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Outlier Detection */}
        {battleData.outliers && battleData.outliers.length > 0 && (
          <Paper p="md" withBorder>
            <Text size="sm" fw={600} mb="md">
              Outliers & Issues Detected
            </Text>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Bot Name</Table.Th>
                  <Table.Th>Strategy</Table.Th>
                  <Table.Th ta="right">Level</Table.Th>
                  <Table.Th ta="right">Attacks</Table.Th>
                  <Table.Th ta="right">Win Rate</Table.Th>
                  <Table.Th>Issue</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {battleData.outliers.map((outlier: any) => (
                  <Table.Tr key={outlier.botId}>
                    <Table.Td>
                      <Text fw={600}>{outlier.botName}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={STRATEGY_COLORS[outlier.strategy]} variant="light">
                        {outlier.strategy}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">{outlier.level}</Table.Td>
                    <Table.Td ta="right">{outlier.totalAttacks}</Table.Td>
                    <Table.Td ta="right">{(outlier.winRate * 100).toFixed(0)}%</Table.Td>
                    <Table.Td>
                      <Badge color={SEVERITY_COLORS[outlier.severity as keyof typeof SEVERITY_COLORS]} size="sm">
                        {outlier.issue.replace(/_/g, ' ')}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Stack>
    );
  }

  function renderUnitCompositionTab() {
    if (unitCompLoading) {
      return <Skeleton height={400} />;
    }

    if (!unitCompData || !unitCompData.composition) {
      return (
        <Text c="dimmed" ta="center" py="xl">
          No unit composition data available.
        </Text>
      );
    }

    return (
      <Stack gap="lg">
        {Object.entries(unitCompData.composition).map(([strategy, data]: [string, any]) => (
          <Paper key={strategy} p="md" withBorder>
            <Text size="sm" fw={600} mb="sm">
              {strategy} — Unit Composition Over Time
            </Text>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={data.dates.map((date: string, idx: number) => ({
                  date,
                  Citizens: data.citizens[idx],
                  Workers: data.workers[idx],
                  Offense: data.offense[idx],
                  Defense: data.defense[idx],
                  Spy: data.spy[idx],
                  Sentry: data.sentry[idx],
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-dark-5)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => new Date(val).toLocaleDateString()}
                  stroke="var(--mantine-color-dark-3)"
                />
                <YAxis stroke="var(--mantine-color-dark-3)" label={{ value: '%', angle: -90 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--mantine-color-dark-7)',
                    border: '1px solid var(--mantine-color-dark-5)',
                  }}
                  formatter={(value: any) => `${value.toFixed(1)}%`}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Citizens"
                  stackId="1"
                  stroke="#999"
                  fill="#999"
                />
                <Area
                  type="monotone"
                  dataKey="Workers"
                  stackId="1"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                />
                <Area
                  type="monotone"
                  dataKey="Offense"
                  stackId="1"
                  stroke="#ff4444"
                  fill="#ff4444"
                />
                <Area
                  type="monotone"
                  dataKey="Defense"
                  stackId="1"
                  stroke="#4c9eff"
                  fill="#4c9eff"
                />
                <Area
                  type="monotone"
                  dataKey="Spy"
                  stackId="1"
                  stroke="#9b59b6"
                  fill="#9b59b6"
                />
                <Area
                  type="monotone"
                  dataKey="Sentry"
                  stackId="1"
                  stroke="#f39c12"
                  fill="#f39c12"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        ))}
      </Stack>
    );
  }
}
