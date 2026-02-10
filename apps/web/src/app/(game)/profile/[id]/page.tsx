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
  Slider,
} from '@mantine/core';
import { OTCard, StatRow } from '@/components/ui';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useApi } from '@/hooks/use-api';
import { getFortificationByLevel, getLevelForXP, toLocale } from '@openthrone/game-logic';

interface AllianceIntelData {
  spiedByName: string;
  spiedAt: string;
  revealPercent: number;
  intelData: Record<string, any>;
}

interface PersonalLastSpy {
  spiedAt: string | null;
  revealPercent: number;
  intelData: Record<string, any>;
}

interface PlayerProfile {
  id: string;
  displayName: string;
  race: string;
  class: string;
  bio: string | null;
  isBot: boolean;
  createdAt: string;
  lastActive: string | null;
  status: string;
  population: number;
  gold: string | null;
  stats: {
    experience: number;
    rank: number;
    offense?: number;
    defense?: number;
    spy?: number;
    sentry?: number;
    level: number;
  } | null;
  fortification: {
    fortLevel: number;
  } | null;
  ranks?: {
    overall: number;
    offense: number;
    defense: number;
    netWorth: number;
  };
  allianceIntel?: AllianceIntelData | null;
  personalLastSpy?: PersonalLastSpy | null;
}

interface AttackResult {
  id: number;
  attackerWins: boolean;
  turnsUsed: number;
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const { api, isReady } = useApi();
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const [attackTurns, setAttackTurns] = useState(1);

  const { data: player, isLoading } = useQuery<PlayerProfile>({
    queryKey: ['player', params.id],
    queryFn: () => api.get(`/player/${params.id}`),
    enabled: !!params.id && isReady,
  });

  const { data: meData } = useQuery<{ economy: { attackTurns: number } | null }>({
    queryKey: ['player', 'me'],
    queryFn: () => api.get('/player/me'),
    enabled: isReady,
  });

  const myAttackTurns = meData?.economy?.attackTurns ?? 0;

  const attackMutation = useMutation({
    mutationFn: ({ defenderId, turns }: { defenderId: string; turns: number }) =>
      api.post(`/battle/attack/${defenderId}`, { turns }) as Promise<AttackResult>,
    onSuccess: (data: AttackResult) => {
      closeConfirm();
      notifications.show({
        title: data.attackerWins ? 'Victory!' : 'Defeat!',
        message: data.attackerWins
          ? `Your attack on ${player?.displayName ?? 'the enemy'} was successful!`
          : `Your attack on ${player?.displayName ?? 'the enemy'} was repelled.`,
        color: data.attackerWins ? 'green' : 'red',
      });
      queryClient.invalidateQueries({ queryKey: ['battle'] });
      queryClient.invalidateQueries({ queryKey: ['player', params.id] });
      queryClient.invalidateQueries({ queryKey: ['player', 'me'] });
      router.push(`/battle/report/${data.id}`);
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

  const isOwnProfile = (session as any)?.user?.id === player.id;
  const experience = player.stats?.experience ?? 0;
  const rank = player.stats?.rank ?? 0;
  const offense = player.stats?.offense;
  const defense = player.stats?.defense;
  const spy = player.stats?.spy;
  const sentry = player.stats?.sentry;
  const fortLevel = player.fortification?.fortLevel ?? 1;
  const hasStats = offense !== undefined;

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
                {player.ranks && player.ranks.overall > 0 && (
                  <Badge variant="filled" color="yellow" size="lg">
                    Rank #{player.ranks.overall}
                  </Badge>
                )}
              </Group>
              <Group gap="xs" wrap="wrap">
                <Badge variant="light" color="blue">
                  {player.race}
                </Badge>
                <Badge variant="light" color="grape">
                  {player.class}
                </Badge>
                <Badge variant="light" color="teal">
                  Level {level}
                </Badge>
                {player.isBot && (
                  <Badge variant="light" color="violet">
                    BOT
                  </Badge>
                )}
                <Badge variant="filled" color="orange" leftSection={'\u2B50'}>
                  Alpha Tester
                </Badge>
              </Group>
              <Group gap="lg">
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  Member since {memberSince}
                </Text>
                {player.lastActive && (
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    Last online: {new Date(player.lastActive).toLocaleDateString()}
                  </Text>
                )}
              </Group>
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

        {/* Player Info */}
        <OTCard>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            <Paper p="xs" withBorder ta="center">
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Population</Text>
              <Text fw={700} size="lg">{player.population.toLocaleString()}</Text>
            </Paper>
            <Paper p="xs" withBorder ta="center">
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Gold on Hand</Text>
              <Text fw={700} size="lg" style={player.gold === null ? { color: 'var(--ot-text-dim)' } : { color: 'var(--ot-success)' }}>
                {player.gold !== null ? Number(player.gold).toLocaleString() : '???'}
              </Text>
            </Paper>
            <Paper p="xs" withBorder ta="center">
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Fort</Text>
              <Text fw={700} size="lg">{fortName}</Text>
            </Paper>
            <Paper p="xs" withBorder ta="center">
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Fort Level</Text>
              <Text fw={700} size="lg">{fortLevel}</Text>
            </Paper>
          </SimpleGrid>
        </OTCard>

          {/* Rankings */}
          {player.ranks && (
            <OTCard>
              <Stack gap="sm">
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
                  <Title order={4} style={{ cursor: 'help', textDecoration: 'underline', textDecorationStyle: 'dotted' as const }}>
                    Rankings
                  </Title>
                </Tooltip>
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                  <Paper p="xs" withBorder ta="center">
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Overall</Text>
                    <Text fw={700} size="lg" style={{ color: 'var(--ot-gold)' }}>
                      #{player.ranks.overall}
                    </Text>
                  </Paper>
                  <Paper p="xs" withBorder ta="center">
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Offense</Text>
                    <Text fw={700} size="lg" style={{ color: 'var(--ot-gold)' }}>
                      #{player.ranks.offense}
                    </Text>
                  </Paper>
                  <Paper p="xs" withBorder ta="center">
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Defense</Text>
                    <Text fw={700} size="lg" style={{ color: 'var(--ot-gold)' }}>
                      #{player.ranks.defense}
                    </Text>
                  </Paper>
                  <Paper p="xs" withBorder ta="center">
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Net Worth</Text>
                    <Text fw={700} size="lg" style={{ color: 'var(--ot-gold)' }}>
                      #{player.ranks.netWorth}
                    </Text>
                  </Paper>
                </SimpleGrid>
              </Stack>
            </OTCard>
          )}

          {/* Combat Stats */}
          <OTCard>
            <Stack gap="sm">
              <Title order={4}>Combat Stats</Title>
              {hasStats ? (
                <>
                  <StatRow label="Offense" value={toLocale(offense ?? 0)} />
                  <StatRow label="Defense" value={toLocale(defense ?? 0)} />
                  <StatRow label="Spy" value={toLocale(spy ?? 0)} />
                  <StatRow label="Sentry" value={toLocale(sentry ?? 0)} />
                </>
              ) : (
                <>
                  {/* Personal last spy */}
                  {player.personalLastSpy && Object.keys(player.personalLastSpy.intelData).length > 0 && (
                    <>
                      <Text size="xs" fw={600} style={{ color: 'var(--ot-gold)' }}>
                        Your last spy {player.personalLastSpy.spiedAt
                          ? `on ${new Date(player.personalLastSpy.spiedAt).toLocaleDateString()}`
                          : ''} ({player.personalLastSpy.revealPercent}% revealed)
                      </Text>
                      {player.personalLastSpy.intelData.offense !== undefined && (
                        <StatRow label="Offense" value={toLocale(player.personalLastSpy.intelData.offense)} />
                      )}
                      {player.personalLastSpy.intelData.defense !== undefined && (
                        <StatRow label="Defense" value={toLocale(player.personalLastSpy.intelData.defense)} />
                      )}
                      {player.personalLastSpy.intelData.spy !== undefined && (
                        <StatRow label="Spy" value={toLocale(player.personalLastSpy.intelData.spy)} />
                      )}
                      {player.personalLastSpy.intelData.sentry !== undefined && (
                        <StatRow label="Sentry" value={toLocale(player.personalLastSpy.intelData.sentry)} />
                      )}
                    </>
                  )}

                  {/* Alliance intel (if different from personal) */}
                  {player.allianceIntel && (
                    <>
                      <Text size="xs" fw={600} mt={player.personalLastSpy ? 'sm' : 0} style={{ color: 'var(--ot-text-dim)' }}>
                        Alliance intel &mdash; spied by {player.allianceIntel.spiedByName} on{' '}
                        {new Date(player.allianceIntel.spiedAt).toLocaleDateString()} ({player.allianceIntel.revealPercent}% revealed)
                      </Text>
                      {player.allianceIntel.intelData.offense !== undefined && (
                        <StatRow label="Offense" value={toLocale(player.allianceIntel.intelData.offense)} />
                      )}
                      {player.allianceIntel.intelData.defense !== undefined && (
                        <StatRow label="Defense" value={toLocale(player.allianceIntel.intelData.defense)} />
                      )}
                      {player.allianceIntel.intelData.spy !== undefined && (
                        <StatRow label="Spy" value={toLocale(player.allianceIntel.intelData.spy)} />
                      )}
                      {player.allianceIntel.intelData.sentry !== undefined && (
                        <StatRow label="Sentry" value={toLocale(player.allianceIntel.intelData.sentry)} />
                      )}
                    </>
                  )}

                  {/* No intel at all */}
                  {!player.personalLastSpy && !player.allianceIntel && (
                    <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                      Send spies to uncover this player&apos;s stats.
                    </Text>
                  )}

                  {/* Show prompt even with intel (in case only partial) */}
                  {(player.personalLastSpy || player.allianceIntel) && (
                    <Text size="xs" mt="xs" style={{ color: 'var(--ot-text-dim)', fontStyle: 'italic' }}>
                      Send more spies for more detail.
                    </Text>
                  )}
                </>
              )}
            </Stack>
          </OTCard>
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
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Their Fort</Text>
              <Text fw={600}>Lv {fortLevel} - {fortName}</Text>
            </Paper>
            <Paper p="xs" withBorder>
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Their Level</Text>
              <Text fw={600}>{level}</Text>
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

          <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
            Casualties are permanent. Gold theft, fort damage, and XP scale with turns used.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeConfirm}>Cancel</Button>
            <Button
              color="red"
              loading={attackMutation.isPending}
              disabled={myAttackTurns < attackTurns}
              onClick={() => attackMutation.mutate({ defenderId: params.id, turns: attackTurns })}
            >
              Attack ({attackTurns} turn{attackTurns > 1 ? 's' : ''})
            </Button>
          </Group>
        </Stack>
      </Modal>

    </Container>
  );
}
