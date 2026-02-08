'use client';

import {
  Container,
  Title,
  Tabs,
  Table,
  TextInput,
  Select,
  Group,
  Badge,
  Text,
  Skeleton,
  Stack,
  Pagination,
  SegmentedControl,
  Button,
  Paper,
  Modal,
  SimpleGrid,
  ActionIcon,
  Tooltip,
  Progress,
  Slider,
  Switch,
  UnstyledButton,
} from '@mantine/core';
import { OTCard } from '@/components/ui';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PlayerEntry {
  id: string;
  displayName: string;
  race: string;
  class: string;
  level: number;
  rank: number;
  offense: number;
  defense: number;
  fortLevel: number;
  fortHP: number;
  fortMaxHP: number;
  population: number;
  armySize: number;
  gold: string;
  lastActive: string | null;
  status: string;
  attacksToday: number;
  maxAttacksPerDay: number;
}

interface RankingEntry {
  rank: number;
  id: string;
  displayName: string;
  race: string;
  class: string;
  level: number;
  score: number;
}

interface PaginatedResponse<T> {
  data: T[];
  attackTurns?: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const RACE_COLORS: Record<string, string> = {
  HUMAN: 'blue',
  ELF: 'green',
  GOBLIN: 'orange',
  UNDEAD: 'grape',
};

const RACE_OPTIONS = [
  { value: '', label: 'All Races' },
  { value: 'HUMAN', label: 'Human' },
  { value: 'ELF', label: 'Elf' },
  { value: 'GOBLIN', label: 'Goblin' },
  { value: 'UNDEAD', label: 'Undead' },
];

const CLASS_OPTIONS = [
  { value: '', label: 'All Classes' },
  { value: 'FIGHTER', label: 'Fighter' },
  { value: 'CLERIC', label: 'Cleric' },
  { value: 'ASSASSIN', label: 'Assassin' },
  { value: 'THIEF', label: 'Thief' },
];

// Sortable column definitions for table header sorting
type SortKey = 'rank' | 'offense' | 'defense' | 'gold' | 'level' | 'population' | 'fortLevel';

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentOrder,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  currentSort: string;
  currentOrder: string;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right' | 'center';
}) {
  const isActive = currentSort === sortKey;
  const arrow = isActive ? (currentOrder === 'asc' ? ' \u25B2' : ' \u25BC') : '';
  return (
    <Table.Th ta={align} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <UnstyledButton
        onClick={() => onSort(sortKey)}
        style={{ color: isActive ? 'var(--ot-gold)' : 'inherit', fontWeight: isActive ? 700 : 600 }}
      >
        {label}{arrow}
      </UnstyledButton>
    </Table.Th>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Badge color="yellow" variant="filled" size="sm">#1</Badge>;
  if (rank === 2) return <Badge color="gray" variant="filled" size="sm">#2</Badge>;
  if (rank === 3) return <Badge color="orange" variant="filled" size="sm">#3</Badge>;
  return <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>#{rank}</Text>;
}

interface AttackResult {
  id: number;
  attackerWins: boolean;
  turnsUsed: number;
  goldStolen: string;
  fortDamage: number;
  attackerCasualties: { total: number; offenseUnits: number };
  defenderCasualties: { total: number; defenseUnits: number; offenseUnits: number };
  attackerXP: number;
  defenderXP: number;
}

export default function PlayersPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [tab, setTab] = useState<string | null>('players');

  // Player list state
  const [search, setSearch] = useState('');
  const [raceFilter, setRaceFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sort, setSort] = useState('rank');
  const [order, setOrder] = useState('asc');
  const [inRange, setInRange] = useState(true);
  const [playerPage, setPlayerPage] = useState(1);

  // Rankings state
  const [rankingType, setRankingType] = useState('overall');
  const [rankingPage, setRankingPage] = useState(1);

  // Attack modal state
  const [attackTarget, setAttackTarget] = useState<PlayerEntry | null>(null);
  const [attackTurns, setAttackTurns] = useState(1);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const [resultOpened, { open: openResult, close: closeResult }] = useDisclosure(false);
  const [attackResult, setAttackResult] = useState<AttackResult | null>(null);

  const attackMutation = useMutation({
    mutationFn: ({ defenderId, turns }: { defenderId: string; turns: number }) =>
      api.post(`/battle/attack/${defenderId}`, { turns }) as Promise<AttackResult>,
    onSuccess: (data: AttackResult) => {
      closeConfirm();
      setAttackResult(data);
      openResult();
      queryClient.invalidateQueries({ queryKey: ['battle'] });
    },
    onError: (err: Error) => {
      closeConfirm();
      notifications.show({ title: 'Attack Failed', message: err.message, color: 'red' });
    },
  });

  const buildPlayerQuery = () => {
    const params = new URLSearchParams();
    params.set('page', String(playerPage));
    params.set('limit', '20');
    params.set('sort', sort);
    params.set('order', order);
    if (search) params.set('search', search);
    if (raceFilter) params.set('race', raceFilter);
    if (classFilter) params.set('class', classFilter);
    if (inRange) params.set('inRange', 'true');
    return params.toString();
  };

  const { data: playersData, isLoading: playersLoading } = useQuery<PaginatedResponse<PlayerEntry>>({
    queryKey: ['battle', 'players', playerPage, search, raceFilter, classFilter, sort, order, inRange],
    queryFn: () => api.get(`/battle/players?${buildPlayerQuery()}`),
    enabled: isReady && tab === 'players',
  });

  const myAttackTurns = playersData?.attackTurns ?? 0;

  const { data: rankingsData, isLoading: rankingsLoading } = useQuery<PaginatedResponse<RankingEntry>>({
    queryKey: ['battle', 'rankings', rankingType, rankingPage],
    queryFn: () => api.get(`/battle/rankings?type=${rankingType}&page=${rankingPage}&limit=20`),
    enabled: isReady && tab === 'rankings',
  });

  const handleSortChange = (newSort: SortKey) => {
    if (newSort === sort) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(newSort);
      setOrder(newSort === 'rank' ? 'asc' : 'desc');
    }
    setPlayerPage(1);
  };

  return (
    <Container size="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={2}>Players & Rankings</Title>
          {tab === 'players' && (
            <Badge
              size="lg"
              variant="light"
              color={myAttackTurns > 0 ? 'green' : 'red'}
            >
              {myAttackTurns} Attack Turn{myAttackTurns !== 1 ? 's' : ''}
            </Badge>
          )}
        </Group>

        <Tabs value={tab} onChange={setTab}>
          <Tabs.List>
            <Tabs.Tab value="players">Find Players</Tabs.Tab>
            <Tabs.Tab value="rankings">Rankings</Tabs.Tab>
          </Tabs.List>

          {/* ── Find Players Tab ──────────────────────────── */}
          <Tabs.Panel value="players" pt="md">
            <Stack gap="md">
              <OTCard>
                <Stack gap="sm">
                  <TextInput
                    placeholder="Search by name..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.currentTarget.value);
                      setPlayerPage(1);
                    }}
                  />
                  <Group grow>
                    <Select
                      data={RACE_OPTIONS}
                      value={raceFilter}
                      onChange={(val) => {
                        setRaceFilter(val ?? '');
                        setPlayerPage(1);
                      }}
                      placeholder="Filter by race"
                      clearable
                    />
                    <Select
                      data={CLASS_OPTIONS}
                      value={classFilter}
                      onChange={(val) => {
                        setClassFilter(val ?? '');
                        setPlayerPage(1);
                      }}
                      placeholder="Filter by class"
                      clearable
                    />
                  </Group>
                  <Switch
                    label="In Range Only (±10 levels)"
                    checked={inRange}
                    onChange={(e) => {
                      setInRange(e.currentTarget.checked);
                      setPlayerPage(1);
                    }}
                  />
                </Stack>
              </OTCard>

              {playersLoading ? (
                <Skeleton height={400} />
              ) : (
                <>
                  <div className="ot-table-scroll">
                    <Table striped>
                      <Table.Thead>
                        <Table.Tr>
                          <SortHeader label="Rank" sortKey="rank" currentSort={sort} currentOrder={order} onSort={handleSortChange} />
                          <Table.Th>Player</Table.Th>
                          <Table.Th>Race / Class</Table.Th>
                          <SortHeader label="Lv" sortKey="level" currentSort={sort} currentOrder={order} onSort={handleSortChange} align="center" />
                          <SortHeader label="Pop" sortKey="population" currentSort={sort} currentOrder={order} onSort={handleSortChange} align="right" />
                          <SortHeader label="Gold" sortKey="gold" currentSort={sort} currentOrder={order} onSort={handleSortChange} align="right" />
                          <SortHeader label="Offense" sortKey="offense" currentSort={sort} currentOrder={order} onSort={handleSortChange} align="right" />
                          <SortHeader label="Defense" sortKey="defense" currentSort={sort} currentOrder={order} onSort={handleSortChange} align="right" />
                          <SortHeader label="Fort" sortKey="fortLevel" currentSort={sort} currentOrder={order} onSort={handleSortChange} align="center" />
                          <Table.Th ta="center">Attacks</Table.Th>
                          <Table.Th ta="right">Actions</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {playersData?.data.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={11}>
                              <Text ta="center" style={{ color: 'var(--ot-text-dim)' }}>
                                No players found.
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        )}
                        {playersData?.data.map((p) => {
                          const fortPercent = p.fortMaxHP > 0 ? Math.round((p.fortHP / p.fortMaxHP) * 100) : 0;
                          const fortColor = fortPercent > 60 ? 'green' : fortPercent > 30 ? 'yellow' : 'red';
                          return (
                            <Table.Tr key={p.id}>
                              <Table.Td>
                                <RankBadge rank={p.rank} />
                              </Table.Td>
                              <Table.Td>
                                <Text
                                  component={Link}
                                  href={`/profile/${p.id}`}
                                  fw={500}
                                  style={{ color: 'var(--ot-gold)', textDecoration: 'none' }}
                                >
                                  {p.displayName}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Group gap={4} wrap="nowrap">
                                  <Badge
                                    variant="light"
                                    size="xs"
                                    color={RACE_COLORS[p.race] ?? 'gray'}
                                  >
                                    {p.race}
                                  </Badge>
                                  <Badge variant="light" color="gray" size="xs">
                                    {p.class}
                                  </Badge>
                                </Group>
                              </Table.Td>
                              <Table.Td ta="center">
                                <Text className="ot-stat-value">{p.level}</Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text className="ot-stat-value">
                                  {p.population.toLocaleString()}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text className="ot-stat-value">
                                  {Number(p.gold).toLocaleString()}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text className="ot-stat-value">
                                  {p.offense.toLocaleString()}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Text className="ot-stat-value">
                                  {p.defense.toLocaleString()}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="center" w={90}>
                                <Tooltip label={`${p.fortHP} / ${p.fortMaxHP} HP`} withArrow>
                                  <Stack gap={2} align="center">
                                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                                      Lv {p.fortLevel}
                                    </Text>
                                    <Progress
                                      value={fortPercent}
                                      color={fortColor}
                                      size="sm"
                                      w="100%"
                                      radius="xl"
                                    />
                                  </Stack>
                                </Tooltip>
                              </Table.Td>
                              <Table.Td ta="center" w={70}>
                                <Tooltip
                                  label={`${p.attacksToday}/${p.maxAttacksPerDay} attacks used today`}
                                  withArrow
                                >
                                  <Text
                                    size="xs"
                                    fw={500}
                                    style={{
                                      color: p.attacksToday >= p.maxAttacksPerDay
                                        ? 'var(--ot-danger)'
                                        : p.attacksToday > 0
                                          ? 'var(--ot-warning)'
                                          : 'var(--ot-text-dim)',
                                    }}
                                  >
                                    {p.attacksToday}/{p.maxAttacksPerDay}
                                  </Text>
                                </Tooltip>
                              </Table.Td>
                              <Table.Td ta="right">
                                <Group gap={4} justify="flex-end" wrap="nowrap">
                                  <Tooltip
                                    label={
                                      p.attacksToday >= p.maxAttacksPerDay
                                        ? 'Max attacks reached today'
                                        : 'Attack'
                                    }
                                    withArrow
                                  >
                                    <ActionIcon
                                      variant="light"
                                      color="red"
                                      size="sm"
                                      disabled={p.attacksToday >= p.maxAttacksPerDay}
                                      onClick={() => {
                                        setAttackTarget(p);
                                        setAttackTurns(1);
                                        openConfirm();
                                      }}
                                    >
                                      {'\u2694'}
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Spy" withArrow>
                                    <ActionIcon
                                      variant="light"
                                      color="blue"
                                      size="sm"
                                      onClick={() => router.push(`/battle/spy?target=${p.id}`)}
                                    >
                                      {'\uD83D\uDC41'}
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </div>

                  {playersData && playersData.pagination.totalPages > 1 && (
                    <Group justify="center">
                      <Pagination
                        total={playersData.pagination.totalPages}
                        value={playerPage}
                        onChange={setPlayerPage}
                      />
                    </Group>
                  )}
                </>
              )}
            </Stack>
          </Tabs.Panel>

          {/* ── Rankings Tab ──────────────────────────────── */}
          <Tabs.Panel value="rankings" pt="md">
            <Stack gap="md">
              <SegmentedControl
                data={[
                  { value: 'overall', label: 'Overall' },
                  { value: 'offense', label: 'Offense' },
                  { value: 'defense', label: 'Defense' },
                  { value: 'spy', label: 'Spy' },
                  { value: 'sentry', label: 'Sentry' },
                ]}
                value={rankingType}
                onChange={(val) => {
                  setRankingType(val);
                  setRankingPage(1);
                }}
              />

              {rankingsLoading ? (
                <Skeleton height={400} />
              ) : (
                <>
                  <div className="ot-table-scroll">
                    <Table striped>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Rank</Table.Th>
                          <Table.Th>Player</Table.Th>
                          <Table.Th>Race</Table.Th>
                          <Table.Th>Class</Table.Th>
                          <Table.Th ta="center">Level</Table.Th>
                          <Table.Th ta="right">Score</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {rankingsData?.data.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={6}>
                              <Text ta="center" style={{ color: 'var(--ot-text-dim)' }}>
                                No rankings yet.
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        )}
                        {rankingsData?.data.map((r) => (
                          <Table.Tr key={r.id}>
                            <Table.Td>
                              <RankBadge rank={r.rank} />
                            </Table.Td>
                            <Table.Td>
                              <Text
                                component={Link}
                                href={`/profile/${r.id}`}
                                fw={500}
                                style={{ color: 'var(--ot-gold)', textDecoration: 'none' }}
                              >
                                {r.displayName}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                variant="light"
                                size="sm"
                                color={RACE_COLORS[r.race] ?? 'gray'}
                              >
                                {r.race}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light" color="gray" size="sm">
                                {r.class}
                              </Badge>
                            </Table.Td>
                            <Table.Td ta="center">
                              <Text className="ot-stat-value">{r.level}</Text>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text className="ot-stat-value">
                                {r.score.toLocaleString()}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </div>

                  {rankingsData && rankingsData.pagination.totalPages > 1 && (
                    <Group justify="center">
                      <Pagination
                        total={rankingsData.pagination.totalPages}
                        value={rankingPage}
                        onChange={setRankingPage}
                      />
                    </Group>
                  )}
                </>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
      {/* ── Confirm Attack Modal ─────────────────────── */}
      <Modal
        opened={confirmOpened}
        onClose={closeConfirm}
        title={<Text fw={600} style={{ color: 'var(--ot-gold)' }}>Confirm Attack</Text>}
        centered
      >
        {attackTarget && (
          <Stack gap="md">
            <Text>
              You are about to attack <Text span fw={700} style={{ color: 'var(--ot-gold)' }}>{attackTarget.displayName}</Text>.
            </Text>
            <SimpleGrid cols={2} spacing="xs">
              <Paper p="xs" withBorder>
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Their Defense</Text>
                <Text fw={600}>{attackTarget.defense.toLocaleString()}</Text>
              </Paper>
              <Paper p="xs" withBorder>
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Their Fort Level</Text>
                <Text fw={600}>{attackTarget.fortLevel}</Text>
              </Paper>
              <Paper p="xs" withBorder>
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Their Level</Text>
                <Text fw={600}>{attackTarget.level}</Text>
              </Paper>
              <Paper p="xs" withBorder>
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Their Army</Text>
                <Text fw={600}>{attackTarget.armySize.toLocaleString()}</Text>
              </Paper>
            </SimpleGrid>

            <Paper p="sm" withBorder style={{ borderColor: 'var(--ot-border)' }}>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>Attack Turns</Text>
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    {myAttackTurns} available
                  </Text>
                </Group>
                <Slider
                  min={1}
                  max={Math.min(10, myAttackTurns)}
                  step={1}
                  value={attackTurns}
                  onChange={setAttackTurns}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 5, label: '5' },
                    { value: 10, label: '10' },
                  ].filter((m) => m.value <= Math.min(10, myAttackTurns))}
                  disabled={myAttackTurns <= 0}
                  styles={{ markLabel: { fontSize: 10 } }}
                />
                <Text size="xs" ta="center" style={{ color: 'var(--ot-text-dim)' }}>
                  Using <Text span fw={700} style={{ color: 'var(--ot-gold)' }}>{attackTurns}</Text> turn{attackTurns > 1 ? 's' : ''} &mdash; rewards and casualties scale with turns used
                </Text>
              </Stack>
            </Paper>

            {attackTarget.attacksToday > 0 && (
              <Text size="sm" style={{ color: 'var(--ot-warning)' }}>
                You have attacked this player {attackTarget.attacksToday}/{attackTarget.maxAttacksPerDay} times today.
              </Text>
            )}

            <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
              Casualties are permanent. Gold theft, fort damage, and XP scale with turns used.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={closeConfirm}>Cancel</Button>
              <Button
                color="red"
                loading={attackMutation.isPending}
                disabled={myAttackTurns < attackTurns}
                onClick={() => attackMutation.mutate({ defenderId: attackTarget.id, turns: attackTurns })}
              >
                Attack ({attackTurns} turn{attackTurns > 1 ? 's' : ''})
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* ── Attack Result Modal ──────────────────────── */}
      <Modal
        opened={resultOpened}
        onClose={closeResult}
        title={
          <Text fw={600} style={{ color: attackResult?.attackerWins ? 'var(--ot-success)' : 'var(--ot-danger)' }}>
            {attackResult?.attackerWins ? 'Victory!' : 'Defeat!'}
          </Text>
        }
        centered
        size="md"
      >
        {attackResult && attackTarget && (
          <Stack gap="md">
            <Text>
              Your {attackResult.turnsUsed > 1 ? `${attackResult.turnsUsed}-turn ` : ''}attack on{' '}
              <Text span fw={700} style={{ color: 'var(--ot-gold)' }}>{attackTarget.displayName}</Text>{' '}
              was {attackResult.attackerWins ? 'successful' : 'repelled'}.
            </Text>
            <SimpleGrid cols={2} spacing="xs">
              {attackResult.attackerWins && (
                <Paper p="xs" withBorder>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Gold Stolen</Text>
                  <Text fw={600} style={{ color: 'var(--ot-success)' }}>{Number(attackResult.goldStolen).toLocaleString()}</Text>
                </Paper>
              )}
              <Paper p="xs" withBorder>
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Your Casualties</Text>
                <Text fw={600} style={{ color: 'var(--ot-danger)' }}>{attackResult.attackerCasualties.total}</Text>
              </Paper>
              <Paper p="xs" withBorder>
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Enemy Casualties</Text>
                <Text fw={600} c="grape">{attackResult.defenderCasualties.total}</Text>
              </Paper>
              {attackResult.fortDamage > 0 && (
                <Paper p="xs" withBorder>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Fort Damage</Text>
                  <Text fw={600} style={{ color: 'var(--ot-warning)' }}>{attackResult.fortDamage}</Text>
                </Paper>
              )}
              <Paper p="xs" withBorder>
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>XP Gained</Text>
                <Text fw={600} style={{ color: 'var(--ot-gold)' }}>{attackResult.attackerXP}</Text>
              </Paper>
            </SimpleGrid>
            <Group justify="flex-end">
              <Button onClick={closeResult}>Close</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
