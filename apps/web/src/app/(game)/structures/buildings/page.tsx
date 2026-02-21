'use client';

import { useEffect } from 'react';
import {
  Container,
  SimpleGrid,
  Stack,
  Group,
  Text,
  Title,
  Button,
  Badge,
  Progress,
  Skeleton,
  Tooltip,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { usePlayerStore } from '@/stores/player-store';
import { OTCard } from '@/components/ui';
import { toLocale } from '@openthrone/game-logic';
import type { PlayerStateSnapshot } from '@openthrone/shared';
import {
  IconWall,
  IconSword,
  IconPick,
  IconEye,
  IconHome,
  IconUsers,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

interface NextLevel {
  level: number;
  name: string;
  cost: number;
  playerLevelRequirement: number;
  fortHitpoints?: number;
  incomeBonusPercent?: number;
  spyOffenseBonus?: number;
  citizensPerDay?: number;
  dailyMercStock?: number;
}

interface Building {
  buildingType: string;
  description: string;
  currentLevel: number;
  currentLevelName: string;
  nextLevel: NextLevel | null;
  canUpgrade: boolean;
  upgradeBlockedReason?: string;
  maxLevel: number;
}

interface BuildingsResponse {
  gold: string;
  goldInBank: string;
  playerLevel: number;
  buildings: Building[];
}

function getBuildingIcon(type: string): ComponentType<{ size?: number | string }> {
  switch (type) {
    case 'FORTIFICATION': return IconWall;
    case 'ARMORY': return IconSword;
    case 'MINE': return IconPick;
    case 'SPY_ACADEMY': return IconEye;
    case 'HOUSING': return IconHome;
    case 'MERCENARY_CAMP': return IconUsers;
    default: return IconWall;
  }
}

function getBuildingTypeName(type: string): string {
  switch (type) {
    case 'FORTIFICATION':
      return 'Fortification';
    case 'ARMORY':
      return 'Armory';
    case 'MINE':
      return 'Mine';
    case 'SPY_ACADEMY':
      return 'Spy Academy';
    case 'HOUSING':
      return 'Housing';
    case 'MERCENARY_CAMP':
      return 'Mercenary Camp';
    default:
      return type;
  }
}

function getEffectLabel(type: string, level: NextLevel | null): string | null {
  if (!level) return null;
  switch (type) {
    case 'FORTIFICATION':
      return level.fortHitpoints != null ? `${toLocale(level.fortHitpoints)} HP` : null;
    case 'MINE':
      return level.incomeBonusPercent != null ? `+${level.incomeBonusPercent}% income` : null;
    case 'SPY_ACADEMY':
      return level.spyOffenseBonus != null ? `+${level.spyOffenseBonus} spy offense` : null;
    case 'HOUSING':
      return level.citizensPerDay != null ? `${level.citizensPerDay} citizens/day` : null;
    case 'MERCENARY_CAMP':
      return level.dailyMercStock != null ? `${level.dailyMercStock} mercs/day` : null;
    case 'ARMORY': {
      // Armory levels gate item tiers: Lv1→T4-5, Lv2→T6-7, Lv3→T8, Lv4→T9, Lv5→T10
      const tierMap: Record<number, string> = { 1: '4-5', 2: '6-7', 3: '8', 4: '9', 5: '10' };
      return `Unlocks tier ${tierMap[level.level] ?? level.level} items`;
    }
    default:
      return null;
  }
}

function getCurrentEffectLabel(type: string, building: Building): string | null {
  if (building.currentLevel === 0) return null;
  switch (type) {
    case 'ARMORY': {
      const maxTierMap: Record<number, number> = { 1: 5, 2: 7, 3: 8, 4: 9, 5: 10 };
      const maxTier = maxTierMap[building.currentLevel] ?? building.currentLevel;
      return `Up to tier ${maxTier} items`;
    }
    default:
      return null;
  }
}

export default function BuildingsPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['player', 'me'] });
  }, [queryClient]);

  const { data, isLoading } = useQuery<BuildingsResponse>({
    queryKey: ['structures', 'buildings'],
    queryFn: () => api.get('/structures/buildings'),
    enabled: isReady,
  });

  const upgradeMutation = useMutation({
    mutationFn: (buildingType: string) =>
      api.post<{ playerState: PlayerStateSnapshot }>('/structures/buildings/upgrade', { buildingType }),
    onSuccess: (data) => {
      // Update Zustand store INSTANTLY (includes level, XP, gold, etc.)
      if (data.playerState) {
        usePlayerStore.getState().updateFromSnapshot(data.playerState);
      }

      // Still invalidate buildings queries for background re-sync
      queryClient.invalidateQueries({ queryKey: ['structures', 'buildings'] });

      notifications.show({
        title: 'Upgrade Complete',
        message: 'Building upgraded successfully!',
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Upgrade Failed',
        message: err.message || 'Could not upgrade building.',
        color: 'red',
      });
    },
  });

  if (isLoading) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="lg">
          <Skeleton height={80} radius="md" />
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={280} radius="md" />
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    );
  }

  if (!data) return null;

  const gold = BigInt(data.gold);
  const goldInBank = BigInt(data.goldInBank);

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Title order={2}>Buildings</Title>

        <OTCard>
          <Group justify="space-between">
            <Group gap="lg">
              <div>
                <Text size="xs" c="var(--ot-text-dim)">
                  Gold on Hand
                </Text>
                <Text fw={700} size="lg">
                  {toLocale(gold)}
                </Text>
              </div>
              <div>
                <Text size="xs" c="var(--ot-text-dim)">
                  Gold in Bank
                </Text>
                <Text fw={700} size="lg">
                  {toLocale(goldInBank)}
                </Text>
              </div>
            </Group>
            <div>
              <Text size="xs" c="var(--ot-text-dim)">
                Player Level
              </Text>
              <Text fw={700} size="lg" ta="right">
                {data.playerLevel}
              </Text>
            </div>
          </Group>
        </OTCard>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {data.buildings.map((building) => {
            const isMaxed = building.currentLevel >= building.maxLevel;
            const meetsLevelReq =
              !building.nextLevel ||
              data.playerLevel >= building.nextLevel.playerLevelRequirement;
            const canAfford =
              building.nextLevel ? gold >= BigInt(building.nextLevel.cost) : true;
            const progressPercent =
              building.maxLevel > 0
                ? (building.currentLevel / building.maxLevel) * 100
                : 0;
            const nextEffect = getEffectLabel(building.buildingType, building.nextLevel);
            const currentEffect = getCurrentEffectLabel(
              building.buildingType,
              building,
            );

            return (
              <OTCard
                key={building.buildingType}
                style={{
                  opacity: !meetsLevelReq && !isMaxed ? 0.7 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <Group gap="xs">
                      <ThemeIcon size="lg" radius="md" variant="light" color="var(--ot-accent)">
                        {(() => { const Icon = getBuildingIcon(building.buildingType); return <Icon size={20} />; })()}
                      </ThemeIcon>
                      <div>
                        <Text fw={700} size="lg">
                          {getBuildingTypeName(building.buildingType)}
                        </Text>
                        <Badge size="xs" variant="light" color="gray">
                          {building.buildingType.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </Group>
                    {isMaxed && (
                      <Badge color="var(--ot-accent)" variant="filled" size="lg">
                        MAX
                      </Badge>
                    )}
                  </Group>

                  <Text size="sm" c="var(--ot-text-dim)">
                    {building.description}
                  </Text>

                  <div>
                    <Group justify="space-between" mb={4}>
                      <Text size="xs" c="var(--ot-text-dim)">
                        Level {building.currentLevel} / {building.maxLevel}
                      </Text>
                      <Text size="xs" fw={600}>
                        {building.currentLevelName}
                      </Text>
                    </Group>
                    <Progress
                      value={progressPercent}
                      size="sm"
                      radius="xl"
                      color="var(--ot-accent)"
                    />
                  </div>

                  {currentEffect && (
                    <Text size="sm" c="var(--ot-success)">
                      Current: {currentEffect}
                    </Text>
                  )}

                  {building.nextLevel && !isMaxed && (
                    <OTCard
                      style={{
                        padding: 'var(--mantine-spacing-xs)',
                        background: 'var(--mantine-color-dark-7, var(--mantine-color-gray-0))',
                      }}
                    >
                      <Stack gap={4}>
                        <Text size="sm" fw={600}>
                          Next: {building.nextLevel.name}
                        </Text>
                        <Group gap="xs">
                          <Text
                            size="sm"
                            c={canAfford ? 'var(--ot-text-dim)' : 'var(--ot-danger)'}
                            fw={canAfford ? 400 : 700}
                          >
                            Cost: {toLocale(building.nextLevel.cost)} gold
                          </Text>
                        </Group>
                        <Text
                          size="xs"
                          c={
                            meetsLevelReq ? 'var(--ot-text-dim)' : 'var(--ot-danger)'
                          }
                        >
                          Requires level {building.nextLevel.playerLevelRequirement}
                        </Text>
                        {nextEffect && (
                          <Text size="sm" c="var(--ot-success)" fw={600}>
                            {nextEffect}
                          </Text>
                        )}
                      </Stack>
                    </OTCard>
                  )}

                  {!isMaxed && (
                    <Tooltip
                      label={building.upgradeBlockedReason || ''}
                      disabled={building.canUpgrade}
                      withArrow
                      multiline
                      w={250}
                    >
                      <div>
                        <Button
                          fullWidth
                          disabled={!building.canUpgrade}
                          loading={
                            upgradeMutation.isPending &&
                            upgradeMutation.variables === building.buildingType
                          }
                          onClick={() =>
                            upgradeMutation.mutate(building.buildingType)
                          }
                          color="var(--ot-accent)"
                          variant="filled"
                        >
                          Upgrade to Level {building.nextLevel?.level ?? building.currentLevel + 1}
                        </Button>
                      </div>
                    </Tooltip>
                  )}
                </Stack>
              </OTCard>
            );
          })}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
