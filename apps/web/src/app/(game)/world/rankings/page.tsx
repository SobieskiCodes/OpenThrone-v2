'use client';

import {
  Container,
  Title,
  Table,
  Text,
  Skeleton,
  Stack,
  Pagination,
  Badge,
  Group,
  Paper,
  SegmentedControl,
  UnstyledButton,
  Tooltip,
} from '@mantine/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { toLocale } from '@openthrone/game-logic';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────

type Period = 'allTime' | 'today';

interface SubType {
  value: string;
  label: string;
  icon: string;
}

interface Category {
  value: string;
  label: string;
  icon: string;
  subTypes: SubType[];
}

interface RankEntry {
  rank: number;
  id: string;
  displayName: string;
  race: string;
  class: string;
  level: number;
  score: number | null;
}

interface RankingsResponse {
  data: RankEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Category Definitions ───────────────────────────────────────────────

const CATEGORIES: Category[] = [
  {
    value: 'global',
    label: 'GLOBAL',
    icon: '\u{1F30D}',
    subTypes: [
      { value: 'overall_power', label: 'Overall Power', icon: '\u{1F451}' },
      { value: 'offense', label: 'Offense', icon: '\u2694\uFE0F' },
      { value: 'defense', label: 'Defense', icon: '\u{1F6E1}\uFE0F' },
      { value: 'level', label: 'Level', icon: '\u{1F4C8}' },
    ],
  },
  {
    value: 'combat',
    label: 'COMBAT',
    icon: '\u2694\uFE0F',
    subTypes: [
      { value: 'attack_wins', label: 'Attack Wins', icon: '\u{1F3AF}' },
      { value: 'total_kills', label: 'Total Kills', icon: '\u{1F480}' },
      { value: 'defense_wins', label: 'Defense Wins', icon: '\u{1F6E1}\uFE0F' },
      { value: 'gold_stolen', label: 'Gold Stolen', icon: '\u{1F4B0}' },
      { value: 'fort_damage', label: 'Fort Damage', icon: '\u{1F3F0}' },
    ],
  },
  {
    value: 'spy',
    label: 'SPY',
    icon: '\u{1F575}\uFE0F',
    subTypes: [
      { value: 'spy_wins', label: 'Spy Wins', icon: '\u{1F3AF}' },
      { value: 'counter_spy_wins', label: 'Counter-Spy Wins', icon: '\u{1F512}' },
      { value: 'total_spy_ops', label: 'Total Spy Ops', icon: '\u{1F4CB}' },
      { value: 'spies_lost', label: 'Spies Lost', icon: '\u{1F480}' },
    ],
  },
  {
    value: 'economy',
    label: 'ECONOMY',
    icon: '\u{1F4B0}',
    subTypes: [
      { value: 'richest_banked', label: 'Richest (Banked)', icon: '\u{1F3E6}' },
      { value: 'net_worth', label: 'Net Worth', icon: '\u{1F4C8}' },
      { value: 'gold_spent', label: 'Gold Spent', icon: '\u{1F6D2}' },
    ],
  },
  {
    value: 'army',
    label: 'ARMY',
    icon: '\u{1F6E1}\uFE0F',
    subTypes: [
      { value: 'largest_army', label: 'Largest Army', icon: '\u2694\uFE0F' },
      { value: 'highest_population', label: 'Highest Population', icon: '\u{1F465}' },
      { value: 'units_trained', label: 'Units Trained', icon: '\u{1F396}\uFE0F' },
    ],
  },
  {
    value: 'social',
    label: 'SOCIAL',
    icon: '\u{1F465}',
    subTypes: [
      { value: 'most_friends', label: 'Most Friends', icon: '\u{1F91D}' },
      { value: 'messages_sent', label: 'Messages Sent', icon: '\u{1F4E8}' },
      { value: 'citizens_recruited', label: 'Citizens Recruited', icon: '\u{1F514}' },
      { value: 'building_upgrades', label: 'Building Upgrades', icon: '\u{1F3F0}' },
    ],
  },
];

const RACE_COLORS: Record<string, string> = {
  HUMAN: 'blue',
  ELF: 'green',
  GOBLIN: 'red',
  UNDEAD: 'grape',
};

function getMedal(rank: number): string | null {
  if (rank === 1) return '\u{1F947}';
  if (rank === 2) return '\u{1F948}';
  if (rank === 3) return '\u{1F949}';
  return null;
}

// ─── Score Formatter ────────────────────────────────────────────────────

function formatScore(score: number, category: string, subType: string): string {
  if (category === 'economy' || subType === 'gold_stolen') {
    return toLocale(score) + ' gold';
  }
  if (category === 'global' && subType === 'level') {
    return 'Level ' + score;
  }
  return toLocale(score);
}

// ─── Component ──────────────────────────────────────────────────────────

export default function RankingsPage() {
  const { api, isReady } = useApi();
  const [period, setPeriod] = useState<Period>('allTime');
  const [categoryValue, setCategoryValue] = useState('global');
  const [subTypeValue, setSubTypeValue] = useState('overall_power');
  const [page, setPage] = useState(1);

  const category = CATEGORIES.find((c) => c.value === categoryValue) ?? CATEGORIES[0]!;
  const subType = category.subTypes.find((s) => s.value === subTypeValue) ?? category.subTypes[0]!;

  // Hide score for global category (offense/defense expose raw combat stats)
  const showScore = categoryValue !== 'global';

  const { data, isLoading } = useQuery<RankingsResponse>({
    queryKey: ['rankings', categoryValue, subTypeValue, period, page],
    queryFn: () =>
      api.get(
        `/battle/rankings/detailed?category=${categoryValue}&subType=${subTypeValue}&period=${period}&page=${page}&limit=25`,
      ),
    enabled: isReady,
  });

  const handleCategoryChange = (val: string) => {
    const cat = CATEGORIES.find((c) => c.value === val);
    setCategoryValue(val);
    setSubTypeValue(cat?.subTypes[0]?.value || '');
    setPage(1);
  };

  const handleSubTypeChange = (val: string) => {
    setSubTypeValue(val);
    setPage(1);
  };

  return (
    <Container size="lg">
      <Stack gap="md">
        <Title order={2}>Rankings</Title>

        {/* All-Time / Today toggle */}
        <SegmentedControl
          value={period}
          onChange={(val) => {
            setPeriod(val as Period);
            setPage(1);
          }}
          data={[
            { value: 'allTime', label: 'All-Time' },
            { value: 'today', label: 'Today' },
          ]}
          size="sm"
          style={{ alignSelf: 'flex-start' }}
        />

        {/* Category selector — icon boxes */}
        <Paper withBorder p="xs">
          <Group gap="xs" justify="center" wrap="wrap">
            {CATEGORIES.map((cat) => {
              const isActive = cat.value === categoryValue;
              return (
                <UnstyledButton
                  key={cat.value}
                  onClick={() => handleCategoryChange(cat.value)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '12px 18px',
                    borderRadius: 8,
                    border: isActive
                      ? '2px solid var(--ot-gold)'
                      : '2px solid transparent',
                    background: isActive
                      ? 'rgba(255, 215, 0, 0.08)'
                      : 'transparent',
                    transition: 'all 0.15s ease',
                    minWidth: 80,
                  }}
                >
                  <Text size="xl">{cat.icon}</Text>
                  <Text
                    size="xs"
                    fw={isActive ? 700 : 500}
                    style={{
                      color: isActive ? 'var(--ot-gold)' : 'var(--ot-text-dim)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {cat.label}
                  </Text>
                </UnstyledButton>
              );
            })}
          </Group>
        </Paper>

        {/* Sub-type pills */}
        <Group gap="xs" wrap="wrap">
          {category.subTypes.map((st) => {
            const isActive = st.value === subTypeValue;
            return (
              <UnstyledButton
                key={st.value}
                onClick={() => handleSubTypeChange(st.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: isActive
                    ? 'var(--ot-gold)'
                    : 'var(--mantine-color-dark-6, rgba(255,255,255,0.06))',
                  color: isActive ? '#000' : 'var(--ot-text-dim)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.85rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{st.icon}</span>
                <span>{st.label}</span>
              </UnstyledButton>
            );
          })}
        </Group>

        {/* Rankings title */}
        <Group gap="sm" align="center">
          <Title order={3} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{subType.icon}</span>
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              {subType.label} Rankings
            </span>
          </Title>
          {subTypeValue === 'overall_power' && (
            <Tooltip
              label={
                <Stack gap={2}>
                  <Text size="xs" fw={700}>Overall Rank Formula</Text>
                  <Text size="xs">Offense: 1.0x weight</Text>
                  <Text size="xs">Defense: 1.0x weight</Text>
                  <Text size="xs">Spy: 1.25x weight</Text>
                  <Text size="xs">Sentry: 1.25x weight</Text>
                  <Text size="xs">Fort Level: exponential bonus</Text>
                  <Text size="xs">XP: small bonus</Text>
                  <Text size="xs">Net Worth: log scale bonus</Text>
                </Stack>
              }
              multiline
              w={220}
            >
              <Text size="xs" style={{ color: 'var(--ot-text-dim)', cursor: 'help', textDecoration: 'underline', textDecorationStyle: 'dotted' as const }}>
                How is this calculated?
              </Text>
            </Tooltip>
          )}
        </Group>

        {/* Rankings table */}
        <Paper withBorder p="md">
          {isLoading || !data ? (
            <Stack gap="sm">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} height={36} />
              ))}
            </Stack>
          ) : (
            <>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th ta="center" w={60}>Rank</Table.Th>
                    <Table.Th>Player</Table.Th>
                    <Table.Th ta="center">Race</Table.Th>
                    <Table.Th ta="center">Level</Table.Th>
                    {showScore && <Table.Th ta="right">Score</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.data.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={showScore ? 5 : 4} ta="center">
                        <Text size="sm" style={{ color: 'var(--ot-text-dim)' }} py="xl">
                          No data yet{period === 'today' ? ' for today' : ''}. Start playing to appear on the leaderboard!
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    data.data.map((entry) => {
                      const medal = getMedal(entry.rank);
                      return (
                        <Table.Tr key={entry.id}>
                          <Table.Td ta="center">
                            {medal ? (
                              <Text size="lg" component="span">{medal}</Text>
                            ) : (
                              <Text size="sm" fw={600} style={{ color: 'var(--ot-text-dim)' }}>
                                #{entry.rank}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            <Text
                              component={Link}
                              href={`/profile/${entry.id}`}
                              fw={600}
                              size="sm"
                              style={{ color: 'var(--ot-gold)', textDecoration: 'none' }}
                            >
                              {entry.displayName}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge
                              size="sm"
                              variant="light"
                              color={RACE_COLORS[entry.race] || 'gray'}
                              style={{ textTransform: 'capitalize' }}
                            >
                              {entry.race.toLowerCase()}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Text size="sm" fw={600}>{entry.level}</Text>
                          </Table.Td>
                          {showScore && entry.score != null && (
                            <Table.Td ta="right">
                              <Text size="sm" fw={700} className="ot-stat-value">
                                {formatScore(entry.score, categoryValue, subTypeValue)}
                              </Text>
                            </Table.Td>
                          )}
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>

              {data.pagination.totalPages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination
                    total={data.pagination.totalPages}
                    value={page}
                    onChange={setPage}
                    size="sm"
                  />
                </Group>
              )}

              <Text size="xs" ta="center" mt="sm" style={{ color: 'var(--ot-text-dim)' }}>
                {toLocale(data.pagination.total)} players ranked
                {period === 'today' && ' today'}
              </Text>
            </>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}
