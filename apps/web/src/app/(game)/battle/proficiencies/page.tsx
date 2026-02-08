'use client';

import {
  Container,
  SimpleGrid,
  Stack,
  Title,
  Text,
  Group,
  Badge,
  Button,
  ActionIcon,
  Skeleton,
} from '@mantine/core';
import { OTCard } from '@/components/ui';
import { useState, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { getLevelForXP } from '@openthrone/game-logic';

interface BonusPoint {
  bonusType: string;
  level: number;
}

interface PlayerData {
  bonusPoints: BonusPoint[];
  stats: { experience: number } | null;
}

const BONUS_TYPE_INFO: Record<string, { label: string; description: string; stat: string }> = {
  OFFENSE: {
    label: 'Offense',
    description: 'Increases your attack strength',
    stat: '+1% offense bonus per point',
  },
  DEFENSE: {
    label: 'Defense',
    description: 'Increases your defense strength',
    stat: '+1% defense bonus per point',
  },
  INTEL: {
    label: 'Intel',
    description: 'Increases spy and sentry effectiveness',
    stat: '+1% spy & sentry bonus per point',
  },
  INCOME: {
    label: 'Income',
    description: 'Increases gold earned per turn',
    stat: '+1% gold per turn per point',
  },
  PRICES: {
    label: 'Prices',
    description: 'Reduces training and armory costs',
    stat: '-1% unit & item cost per point',
  },
  RECRUITING: {
    label: 'Recruiting',
    description: 'Increases citizen recruitment rate',
    stat: '+5% citizens per day per point',
  },
  CASUALTY: {
    label: 'Casualty',
    description: 'Reduces combat casualties taken',
    stat: '-1% casualties per point',
  },
};

export default function ProficienciesPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const { data: player, isLoading } = useQuery<PlayerData>({
    queryKey: ['player', 'me'],
    queryFn: () => api.get('/player/me'),
    enabled: isReady,
  });

  // Local pending changes: bonusType -> delta (positive = points to add)
  const [pending, setPending] = useState<Record<string, number>>({});

  // Reset pending when player data changes
  useEffect(() => {
    setPending({});
  }, [player]);

  const allocateMutation = useMutation({
    mutationFn: async (allocations: { bonusType: string; count: number }[]) => {
      // Call once per point to allocate (backend increments by 1 each call)
      for (const alloc of allocations) {
        for (let i = 0; i < alloc.count; i++) {
          await api.post('/player/me/bonus-points', { bonusType: alloc.bonusType });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['player', 'stat-breakdown'] });
      setPending({});
      notifications.show({
        title: 'Points Allocated',
        message: 'Your proficiency points have been saved.',
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Error',
        message: err.message,
        color: 'red',
      });
    },
  });

  if (isLoading || !player) {
    return (
      <Container size="lg">
        <Stack gap="md">
          <Skeleton height={40} width={300} />
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={160} radius="sm" />
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    );
  }

  const experience = player.stats?.experience ?? 0;
  const level = getLevelForXP(experience);
  const totalSpent = player.bonusPoints.reduce((sum, bp) => sum + bp.level, 0);
  const totalPending = Object.values(pending).reduce((sum, d) => sum + d, 0);
  const availablePoints = level - totalSpent - totalPending;

  const handleIncrement = (bonusType: string) => {
    if (availablePoints <= 0) return;
    setPending((prev) => ({ ...prev, [bonusType]: (prev[bonusType] ?? 0) + 1 }));
  };

  const handleDecrement = (bonusType: string) => {
    const current = pending[bonusType] ?? 0;
    if (current <= 0) return;
    setPending((prev) => ({ ...prev, [bonusType]: current - 1 }));
  };

  const handleSave = () => {
    const allocations = Object.entries(pending)
      .filter(([, count]) => count > 0)
      .map(([bonusType, count]) => ({ bonusType, count }));
    if (allocations.length === 0) return;
    allocateMutation.mutate(allocations);
  };

  const hasPendingChanges = totalPending > 0;

  return (
    <Container size="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={2}>Proficiencies</Title>
          <Badge
            size="lg"
            variant="light"
            color={availablePoints > 0 ? 'green' : 'gray'}
          >
            {availablePoints} point{availablePoints !== 1 ? 's' : ''} available
          </Badge>
        </Group>

        <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
          Allocate proficiency points to boost your kingdom. You earn 1 point per level
          (current level: {level}).
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {player.bonusPoints.map((bp) => {
            const info = BONUS_TYPE_INFO[bp.bonusType];
            if (!info) return null;
            const pendingDelta = pending[bp.bonusType] ?? 0;
            const displayLevel = bp.level + pendingDelta;

            return (
              <OTCard key={bp.bonusType}>
                <Stack gap="sm">
                  <Group justify="space-between" align="center">
                    <Title order={4}>{info.label}</Title>
                    {pendingDelta > 0 && (
                      <Badge size="sm" color="yellow" variant="light">
                        +{pendingDelta}
                      </Badge>
                    )}
                  </Group>
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    {info.description}
                  </Text>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                    {info.stat}
                  </Text>
                  <Group justify="space-between" align="center">
                    <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Level</Text>
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="sm"
                        disabled={pendingDelta <= 0}
                        onClick={() => handleDecrement(bp.bonusType)}
                      >
                        -
                      </ActionIcon>
                      <Text
                        fw={600}
                        className="ot-stat-value"
                        style={{ minWidth: 32, textAlign: 'center' }}
                      >
                        {displayLevel}
                      </Text>
                      <ActionIcon
                        variant="light"
                        color="green"
                        size="sm"
                        disabled={availablePoints <= 0}
                        onClick={() => handleIncrement(bp.bonusType)}
                      >
                        +
                      </ActionIcon>
                    </Group>
                  </Group>
                </Stack>
              </OTCard>
            );
          })}
        </SimpleGrid>

        {hasPendingChanges && (
          <Group justify="flex-end">
            <Button
              variant="light"
              color="gray"
              onClick={() => setPending({})}
            >
              Reset
            </Button>
            <Button
              color="green"
              loading={allocateMutation.isPending}
              onClick={handleSave}
            >
              Save Changes ({totalPending} point{totalPending !== 1 ? 's' : ''})
            </Button>
          </Group>
        )}
      </Stack>
    </Container>
  );
}
