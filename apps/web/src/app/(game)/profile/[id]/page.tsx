'use client';

import {
  Container,
  Card,
  Avatar,
  Group,
  Stack,
  Title,
  Text,
  Badge,
  SimpleGrid,
  Paper,
  Skeleton,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useApi } from '@/hooks/use-api';
import { getFortificationByLevel, getLevelForXP, toLocale } from '@openthrone/game-logic';

interface PlayerProfile {
  id: string;
  displayName: string;
  race: string;
  class: string;
  bio: string | null;
  createdAt: string;
  stats: {
    experience: number;
    rank: number;
    offense: number;
    defense: number;
    spy: number;
    sentry: number;
    level: number;
  } | null;
  fortification: {
    fortLevel: number;
  } | null;
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const { api, isReady } = useApi();

  const { data: player, isLoading } = useQuery<PlayerProfile>({
    queryKey: ['player', params.id],
    queryFn: () => api.get(`/player/${params.id}`),
    enabled: !!params.id && isReady,
  });

  if (isLoading || !player) {
    return (
      <Container size="md">
        <Stack gap="md">
          <Skeleton height={200} radius="md" />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Skeleton height={150} radius="md" />
            <Skeleton height={150} radius="md" />
          </SimpleGrid>
        </Stack>
      </Container>
    );
  }

  const experience = player.stats?.experience ?? 0;
  const rank = player.stats?.rank ?? 0;
  const offense = player.stats?.offense ?? 0;
  const defense = player.stats?.defense ?? 0;
  const spy = player.stats?.spy ?? 0;
  const sentry = player.stats?.sentry ?? 0;
  const fortLevel = player.fortification?.fortLevel ?? 1;

  const level = getLevelForXP(experience);
  const fort = getFortificationByLevel(fortLevel);
  const fortName = fort?.name ?? 'Unknown';
  const memberSince = new Date(player.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Container size="md">
      <Stack gap="md">
        {/* Player Header Card */}
        <Card withBorder shadow="sm" radius="md" p="lg">
          <Group align="flex-start" gap="lg">
            <Avatar size={100} radius="xl" color="blue">
              {player.displayName.charAt(0).toUpperCase()}
            </Avatar>
            <Stack gap="xs" style={{ flex: 1 }}>
              <Group justify="space-between" align="center">
                <Title order={2}>{player.displayName}</Title>
                {rank > 0 && (
                  <Badge variant="filled" color="yellow" size="lg">
                    Rank #{rank}
                  </Badge>
                )}
              </Group>
              <Group gap="xs">
                <Badge variant="light" color="blue">
                  {player.race}
                </Badge>
                <Badge variant="light" color="grape">
                  {player.class}
                </Badge>
                <Badge variant="light" color="teal">
                  Level {level}
                </Badge>
              </Group>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                Member since {memberSince}
              </Text>
              {player.bio && (
                <Text size="sm" mt="xs">
                  {player.bio}
                </Text>
              )}
            </Stack>
          </Group>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {/* Combat Stats */}
          <Paper withBorder p="md" radius="md" className="ot-card">
            <Stack gap="sm">
              <Title order={4}>Combat Stats</Title>
              <Group justify="space-between">
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  Offense
                </Text>
                <Text fw={600} className="ot-stat-value">{toLocale(offense)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  Defense
                </Text>
                <Text fw={600} className="ot-stat-value">{toLocale(defense)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  Spy
                </Text>
                <Text fw={600} className="ot-stat-value">{toLocale(spy)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  Sentry
                </Text>
                <Text fw={600} className="ot-stat-value">{toLocale(sentry)}</Text>
              </Group>
            </Stack>
          </Paper>

          {/* Fortification */}
          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Title order={4}>Fortification</Title>
              <Group justify="space-between">
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  Fort
                </Text>
                <Text fw={600} className="ot-stat-value">{fortName}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  Level
                </Text>
                <Text fw={600} className="ot-stat-value">{fortLevel}</Text>
              </Group>
            </Stack>
          </Paper>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
