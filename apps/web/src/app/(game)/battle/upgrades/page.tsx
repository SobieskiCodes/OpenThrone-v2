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
import { toLocale, getUnitByTypeAndLevel } from '@openthrone/game-logic';
import type { BattleUpgradeDefinition } from '@openthrone/shared';
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

const TYPE_LABELS: Record<string, string> = {
  OFFENSE: 'Offense',
  DEFENSE: 'Defense',
  SPY: 'Spy',
  SENTRY: 'Sentry',
};

const TYPE_ORDER = [
  BattleUpgradeType.OFFENSE,
  BattleUpgradeType.DEFENSE,
  BattleUpgradeType.SPY,
  BattleUpgradeType.SENTRY,
];

/** Map battle upgrade type → unit type */
const UPGRADE_TO_UNIT: Record<string, UnitType> = {
  OFFENSE: UnitType.OFFENSE,
  DEFENSE: UnitType.DEFENSE,
  SPY: UnitType.SPY,
  SENTRY: UnitType.SENTRY,
};

/** Descriptions for each upgrade */
const UPGRADE_DESCRIPTIONS: Record<string, Record<number, string>> = {
  OFFENSE: {
    1: 'A trusty steed for your knights. Adds a combat bonus per mounted unit.',
    2: 'A massive war elephant that crushes enemy lines.',
    3: 'An armored chariot for your elite warriors.',
  },
  DEFENSE: {
    1: 'A watchtower manned by a guard. Detects and repels attackers.',
    2: 'A catapult that hurls stones at invaders.',
    3: 'A massive trebuchet for devastating defensive strikes.',
  },
  SPY: {
    1: 'Disguise your spy to blend in with enemy populations.',
    2: 'An embedded informant inside enemy ranks.',
    3: 'A coordinated network of spies across the realm.',
  },
  SENTRY: {
    1: 'A trained guard dog that sniffs out intruders.',
    2: 'An elevated watch tower for spotting spies at range.',
    3: 'A counter-intelligence headquarters to thwart enemy espionage.',
  },
};

export default function BattleUpgradesPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<string>(BattleUpgradeType.OFFENSE);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery<StructuresStatus>({
    queryKey: ['structures', 'status'],
    queryFn: () => api.get('/structures/status'),
    enabled: isReady,
  });

  const buyMutation = useMutation({
    mutationFn: (data: { upgradeType: string; level: number; quantity: number }) =>
      api.post('/structures/battle-upgrade', data),
    onSuccess: () => {
      setQuantities({});
      setBusyKey(null);
      queryClient.invalidateQueries({ queryKey: ['structures'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
      notifications.show({ title: 'Purchased', message: 'Battle upgrade bought!', color: 'green' });
    },
    onError: (err: Error) => {
      setBusyKey(null);
      notifications.show({ title: 'Purchase Failed', message: err.message, color: 'red' });
    },
  });

  const sellMutation = useMutation({
    mutationFn: (data: { upgradeType: string; level: number; quantity: number }) =>
      api.post('/structures/sell-battle-upgrade', data),
    onSuccess: () => {
      setQuantities({});
      setBusyKey(null);
      queryClient.invalidateQueries({ queryKey: ['structures'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
      notifications.show({ title: 'Sold', message: 'Battle upgrade sold! 75% gold refunded.', color: 'green' });
    },
    onError: (err: Error) => {
      setBusyKey(null);
      notifications.show({ title: 'Sell Failed', message: err.message, color: 'red' });
    },
  });

  if (isLoading || !status) {
    return (
      <Container size="lg">
        <Stack gap="md">
          <Skeleton height={40} width={200} />
          <Skeleton height={100} />
          <Skeleton height={300} />
        </Stack>
      </Container>
    );
  }

  const gold = Number(status.gold);
  const unitType = UPGRADE_TO_UNIT[selectedType] || UnitType.OFFENSE;

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

  /** Get total owned upgrades across all levels for a type */
  const getTotalOwned = (type: string): number =>
    status.battleUpgrades
      .filter((bu) => bu.upgradeType === type)
      .reduce((sum, bu) => sum + bu.quantity, 0);

  /** Get unit name for a given type + tier level */
  const getUnitName = (uType: UnitType, level: number): string => {
    const def = getUnitByTypeAndLevel(uType, level);
    return def?.name ?? `Tier ${level}`;
  };

  const defs = status.definitions.battle.filter((d) => d.type === selectedType);

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

  return (
    <Container size="lg">
      <Stack gap="md">
        <Title order={2}>Battle Upgrades</Title>

        {/* Resource + unit summary */}
        <OTCard>
          <Group justify="space-between" wrap="wrap" gap="md">
            <Stack gap={4}>
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Gold on Hand</Text>
              <Text fw={700} size="lg" className="ot-stat-value">{toLocale(gold)}</Text>
            </Stack>
            {[2, 3, 4].map((tier) => {
              const count = getUnitCount(unitType, tier);
              const name = getUnitName(unitType, tier);
              return (
                <Stack gap={4} key={tier}>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>{name} (T{tier})</Text>
                  <Text fw={700} size="lg" className="ot-stat-value">{toLocale(count)}</Text>
                </Stack>
              );
            })}
          </Group>
        </OTCard>

        {/* Type tabs */}
        <Tabs
          value={selectedType}
          onChange={(val) => {
            setSelectedType(val || BattleUpgradeType.OFFENSE);
            setQuantities({});
          }}
        >
          <Tabs.List>
            {TYPE_ORDER.map((type) => {
              const total = getTotalOwned(type);
              return (
                <Tabs.Tab key={type} value={type}>
                  {TYPE_LABELS[type] || type}
                  {total > 0 && (
                    <Badge size="xs" variant="light" ml={6}>{toLocale(total)}</Badge>
                  )}
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs>

        {/* Upgrade table */}
        <Paper withBorder p="md">
          <Title order={4} mb="sm">
            {TYPE_LABELS[selectedType]} Battle Upgrades
          </Title>
          <Text size="xs" style={{ color: 'var(--ot-text-dim)' }} mb="sm">
            Each upgrade covers 1 unit. You can own up to as many as your unit count of the required tier.
          </Text>

          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Upgrade</Table.Th>
                <Table.Th ta="center">Bonus</Table.Th>
                <Table.Th ta="right">Cost</Table.Th>
                <Table.Th ta="center">Requires</Table.Th>
                <Table.Th ta="center">Owned / Max</Table.Th>
                <Table.Th ta="right">Qty</Table.Th>
                <Table.Th ta="center">Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {defs.map((def) => {
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
                const desc = UPGRADE_DESCRIPTIONS[def.type]?.[def.level] || '';

                return (
                  <Table.Tr key={key} style={locked ? { opacity: 0.5 } : undefined}>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text fw={600} size="sm">{def.name}</Text>
                        {desc && (
                          <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>{desc}</Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td ta="center">+{def.bonus}</Table.Td>
                    <Table.Td ta="right">{toLocale(def.cost)}</Table.Td>
                    <Table.Td ta="center">
                      {locked ? (
                        <Badge color="red" size="xs">
                          Train {unitName} first!
                        </Badge>
                      ) : (
                        <Text size="xs">{unitName} (T{def.minUnitLevel})</Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="center">
                      {toLocale(owned)} / {toLocale(maxUnits)}
                    </Table.Td>
                    <Table.Td ta="right">
                      <NumberInput
                        size="xs"
                        min={0}
                        value={qty || ''}
                        placeholder="0"
                        onChange={(val) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [key]: typeof val === 'number' ? val : 0,
                          }))
                        }
                        disabled={locked}
                        allowNegative={false}
                        w={80}
                        styles={{ input: { textAlign: 'right' } }}
                      />
                    </Table.Td>
                    <Table.Td ta="center">
                      <Group gap={4} wrap="nowrap" justify="center">
                        <Button
                          size="xs"
                          variant="light"
                          disabled={locked || maxBuyable <= 0}
                          onClick={() => {
                            if (maxBuyable > 0) setQuantities((prev) => ({ ...prev, [key]: maxBuyable }));
                          }}
                        >
                          Max
                        </Button>
                        <Button
                          size="xs"
                          disabled={locked || qty <= 0 || qty > maxBuyable}
                          loading={isBuying}
                          onClick={() => handleBuy(def, qty)}
                        >
                          Buy
                        </Button>
                        {owned > 0 && (
                          <Button
                            size="xs"
                            color="orange"
                            variant="light"
                            disabled={qty <= 0 || qty > owned}
                            loading={isSelling}
                            onClick={() => handleSell(def, qty)}
                          >
                            Sell
                          </Button>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      </Stack>
    </Container>
  );
}
