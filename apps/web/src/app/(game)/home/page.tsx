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

export default function DashboardPage() {
  const { api, isReady } = useApi();

  const { data: player, isLoading } = useQuery<PlayerData>({
    queryKey: ['player', 'me'],
    queryFn: () => api.get('/player/me'),
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
  const offense = player.stats?.offense ?? 0;
  const defense = player.stats?.defense ?? 0;
  const spy = player.stats?.spy ?? 0;
  const sentry = player.stats?.sentry ?? 0;

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
  const goldPerTurn = fort?.goldPerTurn ?? 0;

  const totalUnits = player.units?.reduce((sum, u) => sum + u.quantity, 0) ?? 0;

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
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Gold Per Turn
                </Text>
                <Text fw={600} c="green">
                  {toLocale(goldPerTurn)}
                </Text>
              </Group>
            </Stack>
          </Paper>

          {/* Military Summary */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Title order={4}>Military Summary</Title>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Offense
                </Text>
                <Text fw={600}>{toLocale(offense)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Defense
                </Text>
                <Text fw={600}>{toLocale(defense)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Spy
                </Text>
                <Text fw={600}>{toLocale(spy)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Sentry
                </Text>
                <Text fw={600}>{toLocale(sentry)}</Text>
              </Group>
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
