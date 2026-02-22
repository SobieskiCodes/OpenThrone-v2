'use client';

import {
  Container,
  Title,
  Paper,
  Group,
  Stack,
  Text,
  NumberInput,
  Button,
  Table,
  Skeleton,
  Badge,
  Tabs,
} from '@mantine/core';
import { OTCard } from '@/components/ui';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { usePlayerStore } from '@/stores/player-store';
import { toLocale, getUnitByTypeAndLevel } from '@openthrone/game-logic';
import type { BattleUpgradeDefinition, PlayerStateSnapshot } from '@openthrone/shared';
import { BattleUpgradeType, UnitType } from '@openthrone/shared';

interface OwnedBattleUpgrade {
  upgradeType: string;
  level: number;
  quantity: number;
}

interface UnitEntry {
  unitType: string;
  level: number;
  quantity: number;
}

interface StructuresStatus {
  gold: string;
  battleUpgrades: OwnedBattleUpgrade[];
  units: UnitEntry[];
  definitions: {
    battle: BattleUpgradeDefinition[];
  };
}

/** Map battle upgrade type → unit type */
const UPGRADE_TO_UNIT: Record<string, UnitType> = {
  OFFENSE: UnitType.OFFENSE,
  DEFENSE: UnitType.DEFENSE,
  SPY: UnitType.SPY,
  SENTRY: UnitType.SENTRY,
};

export default function BattleUpgradesPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Get gold from Zustand store (always current)
  const goldFromStore = usePlayerStore((state) => state.getGold());

  const { data: status, isLoading } = useQuery<StructuresStatus>({
    queryKey: ['structures', 'status'],
    queryFn: () => api.get('/structures/status'),
    enabled: isReady,
  });

  const buyMutation = useMutation({
    mutationFn: (data: { upgradeType: string; level: number; quantity: number }) =>
      api.post<{ playerState: PlayerStateSnapshot }>('/structures/battle-upgrade', data),
    onSuccess: (response) => {
      // Update Zustand store INSTANTLY (includes level, XP, gold, etc.)
      if (response.playerState) {
        usePlayerStore.getState().updateFromSnapshot(response.playerState);
      }

      // Still invalidate structures queries for background re-sync
      queryClient.invalidateQueries({ queryKey: ['structures'] });

      setQuantities({});
      setBusyKey(null);
      notifications.show({ title: 'Purchased', message: 'Battle upgrade bought!', color: 'green' });
    },
    onError: (err: Error) => {
      setBusyKey(null);
      notifications.show({ title: 'Purchase Failed', message: err.message, color: 'red' });
    },
  });

  const sellMutation = useMutation({
    mutationFn: (data: { upgradeType: string; level: number; quantity: number }) =>
      api.post<{ playerState: PlayerStateSnapshot }>('/structures/sell-battle-upgrade', data),
    onSuccess: (response) => {
      // Update Zustand store INSTANTLY (includes level, XP, gold, etc.)
      if (response.playerState) {
        usePlayerStore.getState().updateFromSnapshot(response.playerState);
      }

      // Still invalidate structures queries for background re-sync
      queryClient.invalidateQueries({ queryKey: ['structures'] });

      setQuantities({});
      setBusyKey(null);
      notifications.show({ title: 'Sold', message: 'Battle upgrade sold! 75% gold refunded.', color: 'green' });
    },
    onError: (err: Error) => {
      setBusyKey(null);
      notifications.show({ title: 'Sell Failed', message: err.message, color: 'red' });
    },
  });

  if (isLoading || !status) {
    return (
      <Container size="xl">
        <Stack gap="md">
          <Skeleton height={40} width={200} />
          <Skeleton height={100} />
          <Skeleton height={300} />
        </Stack>
      </Container>
    );
  }

  const gold = Number(goldFromStore);

  /** Get unit count for a specific type + level */
  const getUnitCount = (uType: string, level: number): number => {
    const entry = status.units.find((u) => u.unitType === uType && u.level === level);
    return entry?.quantity ?? 0;
  };

  /** Get owned quantity of a specific battle upgrade type + level */
  const getOwned = (type: string, level: number): number => {
    const entry = status.battleUpgrades.find(
      (bu) => bu.upgradeType === type && bu.level === level,
    );
    return entry?.quantity ?? 0;
  };

  /** Get unit name for a given type + tier level */
  const getUnitName = (uType: UnitType, level: number): string => {
    const def = getUnitByTypeAndLevel(uType, level);
    return def?.name ?? `Tier ${level}`;
  };

  const handleBuy = (def: BattleUpgradeDefinition, qty: number) => {
    if (qty <= 0) return;
    setBusyKey(`${def.type}_${def.level}_buy`);
    buyMutation.mutate({ upgradeType: def.type, level: def.level, quantity: qty });
  };

  const handleSell = (def: BattleUpgradeDefinition, qty: number) => {
    if (qty <= 0) return;
    setBusyKey(`${def.type}_${def.level}_sell`);
    sellMutation.mutate({ upgradeType: def.type, level: def.level, quantity: qty });
  };

  const renderUpgradeSection = (
    title: string,
    upgradeType: BattleUpgradeType,
    upgrades: BattleUpgradeDefinition[],
  ) => {
    const unitType = UPGRADE_TO_UNIT[upgradeType] || UnitType.OFFENSE;

    return (
      <Paper withBorder p="md" key={upgradeType}>
        <Title order={4} mb="md">{title}</Title>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Upgrade</Table.Th>
              <Table.Th ta="center">Bonus</Table.Th>
              <Table.Th ta="right">Cost</Table.Th>
              <Table.Th ta="center">Owned / Max</Table.Th>
              <Table.Th ta="center">Action</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {upgrades.map((def) => {
              const key = `${def.type}_${def.level}`;
              const owned = getOwned(def.type, def.level);
              const maxUnits = getUnitCount(unitType, def.minUnitLevel);
              const unitName = getUnitName(unitType, def.minUnitLevel);
              const locked = maxUnits <= 0;
              const qty = quantities[key] || 0;
              const maxBuyable = Math.min(
                maxUnits - owned,
                def.cost > 0 ? Math.floor(gold / def.cost) : 0,
              );
              const isBuying = busyKey === key + '_buy';
              const isSelling = busyKey === key + '_sell';

              const statLabel = upgradeType === BattleUpgradeType.OFFENSE ? 'OFF'
                : upgradeType === BattleUpgradeType.DEFENSE ? 'DEF'
                : upgradeType === BattleUpgradeType.SPY ? 'SPY'
                : 'SENTRY';

              const description = upgradeType === BattleUpgradeType.OFFENSE
                ? `War mount - adds ${def.bonus} to offense`
                : upgradeType === BattleUpgradeType.DEFENSE
                ? `Defensive structure - adds ${def.bonus} to defense`
                : upgradeType === BattleUpgradeType.SPY
                ? `Espionage tool - adds ${def.bonus} to spy offense`
                : `Counter-intelligence - adds ${def.bonus} to spy defense`;

              return (
                <Table.Tr key={key} style={locked ? { opacity: 0.6 } : undefined}>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text fw={600} size="sm">{def.name}</Text>
                      <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                        {description}
                      </Text>
                      <Text size="xs" fw={500} style={{ color: locked ? 'var(--mantine-color-red-6)' : 'var(--ot-text-dim)' }}>
                        Requires: {unitName} (Tier {def.minUnitLevel})
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Badge size="sm" variant="light">
                      +{def.bonus} {statLabel}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={500}>{toLocale(def.cost)}</Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Text size="sm">
                      {toLocale(owned)} / {locked ? 0 : toLocale(maxUnits)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    {locked ? (
                      <Badge color="red" size="sm">
                        Train {unitName} first!
                      </Badge>
                    ) : mode === 'buy' ? (
                      <Group gap="xs" wrap="nowrap" justify="center">
                        <NumberInput
                          size="xs"
                          min={0}
                          max={maxBuyable}
                          value={qty || ''}
                          placeholder="0"
                          onChange={(val) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [key]: typeof val === 'number' ? val : 0,
                            }))
                          }
                          allowNegative={false}
                          w={70}
                          styles={{ input: { textAlign: 'center' } }}
                        />
                        <Button
                          size="xs"
                          variant="light"
                          disabled={maxBuyable <= 0}
                          onClick={() => {
                            if (maxBuyable > 0) setQuantities((prev) => ({ ...prev, [key]: maxBuyable }));
                          }}
                        >
                          Max
                        </Button>
                        <Button
                          size="xs"
                          disabled={qty <= 0 || qty > maxBuyable}
                          loading={isBuying}
                          onClick={() => handleBuy(def, qty)}
                        >
                          Buy
                        </Button>
                      </Group>
                    ) : (
                      <Group gap="xs" wrap="nowrap" justify="center">
                        <NumberInput
                          size="xs"
                          min={0}
                          max={owned}
                          value={qty || ''}
                          placeholder="0"
                          onChange={(val) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [key]: typeof val === 'number' ? val : 0,
                            }))
                          }
                          allowNegative={false}
                          w={70}
                          styles={{ input: { textAlign: 'center' } }}
                          disabled={owned <= 0}
                        />
                        <Button
                          size="xs"
                          variant="light"
                          disabled={owned <= 0}
                          onClick={() => {
                            if (owned > 0) setQuantities((prev) => ({ ...prev, [key]: owned }));
                          }}
                        >
                          Max
                        </Button>
                        <Button
                          size="xs"
                          color="orange"
                          disabled={owned <= 0 || qty <= 0 || qty > owned}
                          loading={isSelling}
                          onClick={() => handleSell(def, qty)}
                        >
                          Sell
                        </Button>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Paper>
    );
  };

  const offenseUpgrades = status.definitions.battle.filter(d => d.type === BattleUpgradeType.OFFENSE);
  const defenseUpgrades = status.definitions.battle.filter(d => d.type === BattleUpgradeType.DEFENSE);
  const spyUpgrades = status.definitions.battle.filter(d => d.type === BattleUpgradeType.SPY);
  const sentryUpgrades = status.definitions.battle.filter(d => d.type === BattleUpgradeType.SENTRY);

  return (
    <Container size="xl">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2}>Battle Upgrades</Title>
            <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
              Equip your units with powerful upgrades. Each upgrade requires a unit of the corresponding tier to mount or operate it.
            </Text>
          </Stack>
          <OTCard>
            <Stack gap={4}>
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Gold on Hand</Text>
              <Text fw={700} size="lg" className="ot-stat-value">{toLocale(gold)}</Text>
            </Stack>
          </OTCard>
        </Group>

        {/* Buy/Sell Tabs */}
        <Tabs value={mode} onChange={(val) => {
          setMode((val as 'buy' | 'sell') || 'buy');
          setQuantities({});
        }}>
          <Tabs.List>
            <Tabs.Tab value="buy">Buy</Tabs.Tab>
            <Tabs.Tab value="sell">Sell</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        <Stack gap="lg">
          {renderUpgradeSection('Offense Upgrades', BattleUpgradeType.OFFENSE, offenseUpgrades)}
          {renderUpgradeSection('Defense Upgrades', BattleUpgradeType.DEFENSE, defenseUpgrades)}
          {renderUpgradeSection('Spy Offense Upgrades', BattleUpgradeType.SPY, spyUpgrades)}
          {renderUpgradeSection('Spy Defense Upgrades', BattleUpgradeType.SENTRY, sentryUpgrades)}
        </Stack>
      </Stack>
    </Container>
  );
}
