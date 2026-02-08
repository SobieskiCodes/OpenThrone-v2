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
  Button,
  Modal,
  Tooltip,
} from '@mantine/core';
import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
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

interface AttackResult {
  id: number;
  attackerWins: boolean;
  goldStolen: string;
  fortDamage: number;
  attackerCasualties: { total: number; offenseUnits: number };
  defenderCasualties: { total: number; defenseUnits: number; offenseUnits: number };
  attackerXP: number;
  defenderXP: number;
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const { api, isReady } = useApi();
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const [resultOpened, { open: openResult, close: closeResult }] = useDisclosure(false);
  const [attackResult, setAttackResult] = useState<AttackResult | null>(null);

  const { data: player, isLoading } = useQuery<PlayerProfile>({
    queryKey: ['player', params.id],
    queryFn: () => api.get(`/player/${params.id}`),
    enabled: !!params.id && isReady,
  });

  const attackMutation = useMutation({
    mutationFn: (defenderId: string) => api.post(`/battle/attack/${defenderId}`) as Promise<AttackResult>,
    onSuccess: (data: AttackResult) => {
      closeConfirm();
      setAttackResult(data);
      openResult();
      queryClient.invalidateQueries({ queryKey: ['battle'] });
      queryClient.invalidateQueries({ queryKey: ['player', params.id] });
    },
    onError: (err: Error) => {
      closeConfirm();
      notifications.show({ title: 'Attack Failed', message: err.message, color: 'red' });
    },
  });

  const friendMutation = useMutation({
    mutationFn: () => api.post('/social/add', { friendId: params.id, relationshipType: 'FRIEND' }),
    onSuccess: () => {
      notifications.show({ title: 'Friend Request Sent', message: `Friend request sent to ${player?.displayName ?? 'player'}.`, color: 'green' });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  const enemyMutation = useMutation({
    mutationFn: () => api.post('/social/add', { friendId: params.id, relationshipType: 'ENEMY' }),
    onSuccess: () => {
      notifications.show({ title: 'Enemy Added', message: `${player?.displayName ?? 'Player'} marked as enemy.`, color: 'red' });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
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

        {/* Action Buttons */}
        <Group gap="sm" wrap="wrap">
          <Tooltip label="Attack this player" withArrow>
            <Button
              variant="light"
              color="red"
              leftSection={'\u2694'}
              onClick={openConfirm}
            >
              Attack
            </Button>
          </Tooltip>
          <Tooltip label="Send spies on a mission" withArrow>
            <Button
              variant="light"
              color="blue"
              leftSection={'\uD83D\uDC41'}
              onClick={() => router.push(`/battle/spy?target=${params.id}`)}
            >
              Spy
            </Button>
          </Tooltip>
          <Tooltip label="Add as friend" withArrow>
            <Button
              variant="light"
              color="green"
              leftSection={'\u002B'}
              loading={friendMutation.isPending}
              onClick={() => friendMutation.mutate()}
            >
              Add Friend
            </Button>
          </Tooltip>
          <Tooltip label="Mark as enemy" withArrow>
            <Button
              variant="light"
              color="red"
              leftSection={'\u2620'}
              loading={enemyMutation.isPending}
              onClick={() => enemyMutation.mutate()}
            >
              Enemy
            </Button>
          </Tooltip>
          <Tooltip label="Block communications (chats & mail)" withArrow>
            <Button
              variant="light"
              color="orange"
              leftSection={'\u26D4'}
              onClick={() => notifications.show({ title: 'Coming Soon', message: 'Blocking communications will be available in a future update.', color: 'orange' })}
            >
              Block
            </Button>
          </Tooltip>
          <Tooltip label="Send a message" withArrow>
            <Button
              variant="light"
              color="grape"
              leftSection={'\u2709'}
              onClick={() => router.push(`/messaging?compose=${params.id}`)}
            >
              Message
            </Button>
          </Tooltip>
        </Group>

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

      {/* Confirm Attack Modal */}
      <Modal
        opened={confirmOpened}
        onClose={closeConfirm}
        title={<Text fw={600} style={{ color: 'var(--ot-gold)' }}>Confirm Attack</Text>}
        centered
      >
        <Stack gap="md">
          <Text>
            You are about to attack <Text span fw={700} style={{ color: 'var(--ot-gold)' }}>{player.displayName}</Text>.
          </Text>
          <SimpleGrid cols={2} spacing="xs">
            <Paper p="xs" withBorder>
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Their Defense</Text>
              <Text fw={600}>{toLocale(defense)}</Text>
            </Paper>
            <Paper p="xs" withBorder>
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Their Fort</Text>
              <Text fw={600}>Lv {fortLevel} - {fortName}</Text>
            </Paper>
            <Paper p="xs" withBorder>
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Their Level</Text>
              <Text fw={600}>{level}</Text>
            </Paper>
          </SimpleGrid>
          <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
            This will cost 1 attack turn. Casualties are permanent.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeConfirm}>Cancel</Button>
            <Button
              color="red"
              loading={attackMutation.isPending}
              onClick={() => attackMutation.mutate(params.id)}
            >
              Confirm Attack
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Attack Result Modal */}
      <Modal
        opened={resultOpened}
        onClose={closeResult}
        title={
          <Text fw={600} style={{ color: attackResult?.attackerWins ? '#4ecdc4' : '#ff6b6b' }}>
            {attackResult?.attackerWins ? 'Victory!' : 'Defeat!'}
          </Text>
        }
        centered
        size="md"
      >
        {attackResult && (
          <Stack gap="md">
            <Text>
              Your attack on <Text span fw={700} style={{ color: 'var(--ot-gold)' }}>{player.displayName}</Text>{' '}
              was {attackResult.attackerWins ? 'successful' : 'repelled'}.
            </Text>
            <SimpleGrid cols={2} spacing="xs">
              {attackResult.attackerWins && (
                <Paper p="xs" withBorder>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Gold Stolen</Text>
                  <Text fw={600} style={{ color: '#4ecdc4' }}>{Number(attackResult.goldStolen).toLocaleString()}</Text>
                </Paper>
              )}
              <Paper p="xs" withBorder>
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Your Casualties</Text>
                <Text fw={600} style={{ color: '#ff6b6b' }}>{attackResult.attackerCasualties.total}</Text>
              </Paper>
              <Paper p="xs" withBorder>
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Enemy Casualties</Text>
                <Text fw={600} style={{ color: '#c44dff' }}>{attackResult.defenderCasualties.total}</Text>
              </Paper>
              {attackResult.fortDamage > 0 && (
                <Paper p="xs" withBorder>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Fort Damage</Text>
                  <Text fw={600} style={{ color: '#ffa07a' }}>{attackResult.fortDamage}</Text>
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
