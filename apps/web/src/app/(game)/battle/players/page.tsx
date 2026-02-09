'use client';

import {
  Container,
  Title,
  Table,
  TextInput,
  Select,
  Group,
  Badge,
  Text,
  Skeleton,
  Stack,
  Pagination,
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

interface AllianceIntelEntry {
  spiedByName: string;
  spiedAt: string;
  revealPercent: number;
  intelData: Record<string, any>;
}

interface PlayerEntry {
  id: string;
  displayName: string;
  race: string;
  class: string;
  level: number;
  rank: number;
  fortLevel: number;
  fortHP: number;
  fortMaxHP: number;
  population: number;
  armySize: number;
  gold: string | null;
  lastActive: string | null;
  status: string;
  attacksToday: number;
  maxAttacksPerDay: number;
  allianceIntel: AllianceIntelEntry | null;
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
type SortKey = 'rank' | 'gold' | 'level' | 'population' | 'fortLevel';

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
}

export default function PlayersPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Player list state
  const [search, setSearch] = useState('');
  const [raceFilter, setRaceFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sort, setSort] = useState('rank');
  const [order, setOrder] = useState('asc');
  const [inRange, setInRange] = useState(true);
  const [playerPage, setPlayerPage] = useState(1);

  // Attack modal state
  const [attackTarget, setAttackTarget] = useState<PlayerEntry | null>(null);
  const [attackTurns, setAttackTurns] = useState(1);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);

  const attackMutation = useMutation({
    mutationFn: ({ defenderId, turns }: { defenderId: string; turns: number }) =>
      api.post(`/battle/attack/${defenderId}`, { turns }) as Promise<AttackResult>,
    onSuccess: (data: AttackResult) => {
      closeConfirm();
      notifications.show({
        title: data.attackerWins ? 'Victory!' : 'Defeat!',
        message: data.attackerWins
          ? `Your attack on ${attackTarget?.displayName ?? 'the enemy'} was successful!`
          : `Your attack on ${attackTarget?.displayName ?? 'the enemy'} was repelled.`,
        color: data.attackerWins ? 'green' : 'red',
      });
      queryClient.invalidateQueries({ queryKey: ['battle'] });
      router.push(`/battle/report/${data.id}`);
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
    enabled: isReady,
  });

  const myAttackTurns = playersData?.attackTurns ?? 0;

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
          <Title order={2}>Find Players</Title>
          <Badge
            size="lg"
            variant="light"
            color={myAttackTurns > 0 ? 'green' : 'red'}
          >
            {myAttackTurns} Attack Turn{myAttackTurns !== 1 ? 's' : ''}
          </Badge>
        </Group>

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
                          <SortHeader label="Fort" sortKey="fortLevel" currentSort={sort} currentOrder={order} onSort={handleSortChange} align="center" />
                          <Table.Th ta="center">Attacks</Table.Th>
                          <Table.Th ta="right">Actions</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {playersData?.data.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={9}>
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
                                <Text className="ot-stat-value" style={p.gold === null ? { color: 'var(--ot-text-dim)' } : undefined}>
                                  {p.gold !== null ? Number(p.gold).toLocaleString() : '???'}
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
    </Container>
  );
}
