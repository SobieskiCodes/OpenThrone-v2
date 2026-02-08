'use client';

import {
  Container,
  SimpleGrid,
  Paper,
  Group,
  Stack,
  Title,
  Text,
  Progress,
  Badge,
  Skeleton,
  Tooltip,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import {
  getFortificationByLevel,
  getLevelForXP,
  getXPForLevel,
  getXPToNextLevel,
  toLocale,
} from '@openthrone/game-logic';

interface PlayerUnit {
  unitType: string;
  quantity: number;
}

interface PlayerData {
  id: string;
  displayName: string;
  race: string;
  class: string;
  economy: {
    gold: string;
    goldInBank: string;
    attackTurns: number;
    houseLevel: number;
    economyLevel: number;
  };
  stats: {
    experience: number;
    offense: number;
    defense: number;
    spy: number;
    sentry: number;
  };
  fortification: {
    fortLevel: number;
    hitpoints: number;
  };
  units: PlayerUnit[];
}

interface StatBreakdown {
  units: number;
  items: number;
  battleUpgrades: number;
  bonusPercent: number;
  bonusAmount: number;
  total: number;
}

interface GoldPerTurnBreakdown {
  fortGold: number;
  workerGold: number;
  incomeBonus: number;
  incomeBonusPercent: number;
  total: number;
}

interface CitizensPerDayBreakdown {
  houseBase: number;
  recruitBonus: number;
  recruitBonusPercent: number;
  total: number;
}

interface BreakdownData {
  offense: StatBreakdown;
  defense: StatBreakdown;
  spy: StatBreakdown;
  sentry: StatBreakdown;
  goldPerTurn: GoldPerTurnBreakdown;
  citizensPerDay: CitizensPerDayBreakdown;
}

function StatTooltipContent({ label, bd }: { label: string; bd: StatBreakdown }) {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={700}>{label} Breakdown</Text>
      <Text size="xs">Units: {toLocale(bd.units)}</Text>
      <Text size="xs">Items: {toLocale(bd.items)}</Text>
      <Text size="xs">Battle Upgrades: {toLocale(bd.battleUpgrades)}</Text>
      <Text size="xs">Bonus: +{bd.bonusPercent}% ({toLocale(bd.bonusAmount)})</Text>
      <Text size="xs" fw={600}>Total: {toLocale(bd.total)}</Text>
    </Stack>
  );
}

function GoldTooltipContent({ bd }: { bd: GoldPerTurnBreakdown }) {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={700}>Gold Per Turn Breakdown</Text>
      <Text size="xs">Fort Income: {toLocale(bd.fortGold)}</Text>
      <Text size="xs">Workers: {toLocale(bd.workerGold)}</Text>
      {bd.incomeBonusPercent > 0 && (
        <Text size="xs">Income Bonus: +{bd.incomeBonusPercent}% ({toLocale(bd.incomeBonus)})</Text>
      )}
      <Text size="xs" fw={600}>Total: {toLocale(bd.total)}</Text>
    </Stack>
  );
}

function CitizensTooltipContent({ bd }: { bd: CitizensPerDayBreakdown }) {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={700}>Citizens Per Day Breakdown</Text>
      <Text size="xs">Housing: {toLocale(bd.houseBase)}</Text>
      {bd.recruitBonusPercent > 0 && (
        <Text size="xs">Recruit Bonus: +{bd.recruitBonusPercent}% ({toLocale(bd.recruitBonus)})</Text>
      )}
      <Text size="xs" fw={600}>Total: {toLocale(bd.total)}</Text>
    </Stack>
  );
}

export default function DashboardPage() {
  const { api, isReady } = useApi();

  const { data: player, isLoading } = useQuery<PlayerData>({
    queryKey: ['player', 'me'],
    queryFn: () => api.get('/player/me'),
    enabled: isReady,
  });

  const { data: breakdown } = useQuery<BreakdownData>({
    queryKey: ['player', 'stat-breakdown'],
    queryFn: () => api.get('/player/me/stat-breakdown'),
    enabled: isReady,
  });

  if (isLoading || !player) {
    return (
      <Container>
        <Stack gap="md">
          <Skeleton height={40} width={300} />
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={180} radius="md" />
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    );
  }

  const experience = player.stats?.experience ?? 0;
  const gold = Number(player.economy?.gold ?? 0);
  const goldInBank = Number(player.economy?.goldInBank ?? 0);
  const attackTurns = player.economy?.attackTurns ?? 0;
  const fortLevel = player.fortification?.fortLevel ?? 1;
  const fortHitpoints = player.fortification?.hitpoints ?? 0;

  const level = getLevelForXP(experience);
  const currentLevelXP = getXPForLevel(level);
  const xpToNext = getXPToNextLevel(experience);
  const nextLevelXP = getXPForLevel(level + 1);
  const xpProgress =
    nextLevelXP > currentLevelXP
      ? ((experience - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
      : 100;

  const fort = getFortificationByLevel(fortLevel);
  const fortName = fort?.name ?? 'Unknown';
  const fortMaxHp = fort?.hitpoints ?? 1;
  const fortHpPercent = Math.min(100, (fortHitpoints / fortMaxHp) * 100);

  const totalUnits = player.units?.reduce((sum, u) => sum + u.quantity, 0) ?? 0;

  // Use breakdown totals for display (live-calculated), fallback to stored stats
  const offense = breakdown?.offense.total ?? player.stats?.offense ?? 0;
  const defense = breakdown?.defense.total ?? player.stats?.defense ?? 0;
  const spy = breakdown?.spy.total ?? player.stats?.spy ?? 0;
  const sentry = breakdown?.sentry.total ?? player.stats?.sentry ?? 0;
  const goldPerTurn = breakdown?.goldPerTurn.total ?? fort?.goldPerTurn ?? 0;
  const citizensPerDay = breakdown?.citizensPerDay.total ?? 0;

  return (
    <Container size="xl">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={2}>{player.displayName}&apos;s Kingdom</Title>
          <Group gap="xs">
            <Badge variant="light" color="blue">
              {player.race}
            </Badge>
            <Badge variant="light" color="grape">
              {player.class}
            </Badge>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {/* Kingdom Overview */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Title order={4}>Kingdom Overview</Title>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Level
                </Text>
                <Text fw={600}>{level}</Text>
              </Group>
              <div>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" c="dimmed">
                    XP Progress
                  </Text>
                  <Text size="xs" c="dimmed">
                    {toLocale(experience)} / {toLocale(nextLevelXP || experience)}
                  </Text>
                </Group>
                <Progress value={xpProgress} size="sm" color="blue" />
                <Text size="xs" c="dimmed" mt={4}>
                  {toLocale(xpToNext)} XP to next level
                </Text>
              </div>
            </Stack>
          </Paper>

          {/* Economy */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Title order={4}>Economy</Title>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Gold
                </Text>
                <Text fw={600}>{toLocale(gold)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Gold in Bank
                </Text>
                <Text fw={600}>{toLocale(goldInBank)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Attack Turns
                </Text>
                <Text fw={600}>{toLocale(attackTurns)}</Text>
              </Group>
              <Tooltip
                label={breakdown?.goldPerTurn ? <GoldTooltipContent bd={breakdown.goldPerTurn} /> : 'Loading...'}
                multiline
                w={220}
                withArrow
              >
                <Group justify="space-between" style={{ cursor: 'help' }}>
                  <Text size="sm" c="dimmed" td="underline" style={{ textDecorationStyle: 'dotted' }}>
                    Gold Per Turn
                  </Text>
                  <Text fw={600} c="green">
                    {toLocale(goldPerTurn)}
                  </Text>
                </Group>
              </Tooltip>
              <Tooltip
                label={breakdown?.citizensPerDay ? <CitizensTooltipContent bd={breakdown.citizensPerDay} /> : 'Loading...'}
                multiline
                w={220}
                withArrow
              >
                <Group justify="space-between" style={{ cursor: 'help' }}>
                  <Text size="sm" c="dimmed" td="underline" style={{ textDecorationStyle: 'dotted' }}>
                    Citizens Per Day
                  </Text>
                  <Text fw={600} c="teal">
                    {toLocale(citizensPerDay)}
                  </Text>
                </Group>
              </Tooltip>
            </Stack>
          </Paper>

          {/* Military Summary */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Title order={4}>Military Summary</Title>
              {(['offense', 'defense', 'spy', 'sentry'] as const).map((stat) => {
                const value = { offense, defense, spy, sentry }[stat];
                const bd = breakdown?.[stat];
                const label = stat.charAt(0).toUpperCase() + stat.slice(1);
                return (
                  <Tooltip
                    key={stat}
                    label={bd ? <StatTooltipContent label={label} bd={bd} /> : 'Loading...'}
                    multiline
                    w={220}
                    withArrow
                  >
                    <Group justify="space-between" style={{ cursor: 'help' }}>
                      <Text size="sm" c="dimmed" td="underline" style={{ textDecorationStyle: 'dotted' }}>
                        {label}
                      </Text>
                      <Text fw={600}>{toLocale(value)}</Text>
                    </Group>
                  </Tooltip>
                );
              })}
            </Stack>
          </Paper>

          {/* Population */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Title order={4}>Population</Title>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Total Units
                </Text>
                <Text fw={600}>{toLocale(totalUnits)}</Text>
              </Group>
              {player.units?.map((unit) => (
                <Group key={unit.unitType} justify="space-between">
                  <Text size="sm" c="dimmed">
                    {unit.unitType}
                  </Text>
                  <Text size="sm">{toLocale(unit.quantity)}</Text>
                </Group>
              ))}
            </Stack>
          </Paper>

          {/* Fort */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Title order={4}>Fortification</Title>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Fort
                </Text>
                <Text fw={600}>
                  {fortName} (Level {fortLevel})
                </Text>
              </Group>
              <div>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" c="dimmed">
                    Hitpoints
                  </Text>
                  <Text size="xs" c="dimmed">
                    {toLocale(fortHitpoints)} / {toLocale(fortMaxHp)}
                  </Text>
                </Group>
                <Progress
                  value={fortHpPercent}
                  size="sm"
                  color={fortHpPercent > 50 ? 'green' : fortHpPercent > 25 ? 'yellow' : 'red'}
                />
              </div>
            </Stack>
          </Paper>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
