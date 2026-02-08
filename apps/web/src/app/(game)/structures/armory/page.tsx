'use client';

import {
  Container,
  Title,
  Group,
  Stack,
  Text,
  NumberInput,
  Button,
  Table,
  Skeleton,
  Badge,
  Tabs,
  Paper,
} from '@mantine/core';
import { OTCard } from '@/components/ui';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { toLocale } from '@openthrone/game-logic';
import type { ItemDefinition } from '@openthrone/shared';
import { ItemUsage, ItemType } from '@openthrone/shared';

interface ItemEntry {
  itemType: string;
  usage: string;
  level: number;
  quantity: number;
}

interface ArmoryStatus {
  gold: string;
  goldInBank: string;
  armoryLevel: number;
  spyAcademyLevel: number;
  pricesBonusLevel: number;
  playerRace: string;
  items: ItemEntry[];
  itemDefinitions: ItemDefinition[];
}

const USAGE_LABELS: Record<string, string> = {
  OFFENSE: 'Offense',
  DEFENSE: 'Defense',
  SPY: 'Spy',
  SENTRY: 'Sentry',
};

const STAT_LABELS: Record<string, string> = {
  OFFENSE: 'OFF',
  DEFENSE: 'DEF',
  SPY: 'SPY',
  SENTRY: 'SENTRY',
};

const USAGE_ORDER = [
  ItemUsage.OFFENSE,
  ItemUsage.DEFENSE,
  ItemUsage.SPY,
  ItemUsage.SENTRY,
];

const ITEM_TYPE_LABELS: Record<string, string> = {
  WEAPON: 'Weapons',
  ARMOR: 'Armor',
};

const ITEM_TYPE_ORDER = [ItemType.WEAPON, ItemType.ARMOR];

export default function ArmoryPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [selectedUsage, setSelectedUsage] = useState<string>(ItemUsage.OFFENSE);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery<ArmoryStatus>({
    queryKey: ['armory', 'status'],
    queryFn: () => api.get('/armory/status'),
    enabled: isReady,
  });

  const equipMutation = useMutation({
    mutationFn: (item: { itemType: string; usage: string; level: number; quantity: number }) =>
      api.post('/armory/equip', item),
    onSuccess: () => {
      setQuantities({});
      setBusyKey(null);
      queryClient.invalidateQueries({ queryKey: ['armory'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
      notifications.show({ title: 'Equipped', message: 'Items purchased!', color: 'green' });
    },
    onError: (err: Error) => {
      setBusyKey(null);
      notifications.show({ title: 'Purchase Failed', message: err.message, color: 'red' });
    },
  });

  const unequipMutation = useMutation({
    mutationFn: (item: { itemType: string; usage: string; level: number; quantity: number }) =>
      api.post('/armory/unequip', item),
    onSuccess: () => {
      setQuantities({});
      setBusyKey(null);
      queryClient.invalidateQueries({ queryKey: ['armory'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
      notifications.show({ title: 'Sold', message: 'Items sold! 75% gold refunded.', color: 'green' });
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
          <Skeleton height={400} />
        </Stack>
      </Container>
    );
  }

  const gold = Number(status.gold);
  const { armoryLevel, spyAcademyLevel, pricesBonusLevel, playerRace } = status;

  const getOwned = (itemType: string, usage: string, level: number): number => {
    const entry = status.items.find(
      (i) => i.itemType === itemType && i.usage === usage && i.level === level,
    );
    return entry?.quantity ?? 0;
  };

  const getTotalEquipped = (usage: string): number =>
    status.items
      .filter((i) => i.usage === usage)
      .reduce((sum, i) => sum + i.quantity, 0);

  const getDiscountedCost = (cost: number) =>
    cost - Math.ceil((pricesBonusLevel / 100) * cost);

  /** Get the building level that gates this usage type */
  const getBuildingLevel = (usage: string): number =>
    usage === ItemUsage.SPY || usage === ItemUsage.SENTRY
      ? spyAcademyLevel
      : armoryLevel;

  /** Get the building name for locked badge */
  const getBuildingName = (usage: string): string =>
    usage === ItemUsage.SPY || usage === ItemUsage.SENTRY
      ? 'Spy Academy'
      : 'Armory';

  const handleBuy = (def: ItemDefinition, qty: number) => {
    if (qty <= 0) return;
    setBusyKey(def.id + '_buy');
    equipMutation.mutate({ itemType: def.type, usage: def.usage, level: def.level, quantity: qty });
  };

  const handleSell = (def: ItemDefinition, qty: number) => {
    if (qty <= 0) return;
    setBusyKey(def.id + '_sell');
    unequipMutation.mutate({ itemType: def.type, usage: def.usage, level: def.level, quantity: qty });
  };

  const getFilteredDefs = (usage: string, itemType: ItemType) =>
    status.itemDefinitions.filter(
      (d) =>
        d.usage === usage &&
        d.type === itemType &&
        (d.race === 'ALL' || d.race === playerRace),
    );

  const statLabel = STAT_LABELS[selectedUsage] || selectedUsage;
  const buildingLevel = getBuildingLevel(selectedUsage);
  const buildingName = getBuildingName(selectedUsage);

  const renderItemTable = (itemType: ItemType) => {
    const defs = getFilteredDefs(selectedUsage, itemType);
    if (defs.length === 0) return null;

    return (
      <div key={`${selectedUsage}-${itemType}`}>
        <Text fw={600} size="sm" mt="sm" mb={4}>
          {ITEM_TYPE_LABELS[itemType] || itemType}
        </Text>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th ta="center">Stats</Table.Th>
              <Table.Th ta="right">Cost</Table.Th>
              <Table.Th ta="center">Owned</Table.Th>
              <Table.Th ta="right">Qty</Table.Th>
              <Table.Th ta="center">Action</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {defs.map((def) => {
              const owned = getOwned(def.type, def.usage, def.level);
              const locked = def.armoryLevel > buildingLevel;
              const discountedCost = getDiscountedCost(def.cost);
              const qty = quantities[def.id] || 0;
              const maxByGold = discountedCost > 0 ? Math.floor(gold / discountedCost) : 0;
              const isBuying = busyKey === def.id + '_buy';
              const isSelling = busyKey === def.id + '_sell';

              return (
                <Table.Tr key={def.id} style={locked ? { opacity: 0.5 } : undefined}>
                  <Table.Td>
                    {def.name}
                    {locked && (
                      <Badge color="red" size="xs" ml="xs">
                        {buildingName} Lv {def.armoryLevel}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td ta="center">+{def.bonus} {statLabel}</Table.Td>
                  <Table.Td ta="right">
                    {toLocale(discountedCost)}
                    {pricesBonusLevel > 0 && discountedCost < def.cost && (
                      <Text component="span" size="xs" c="green"> (-{pricesBonusLevel}%)</Text>
                    )}
                  </Table.Td>
                  <Table.Td ta="center">{toLocale(owned)}</Table.Td>
                  <Table.Td ta="right">
                    <NumberInput
                      size="xs"
                      min={0}
                      value={qty || ''}
                      placeholder="0"
                      onChange={(val) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [def.id]: typeof val === 'number' ? val : 0,
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
                        disabled={locked}
                        onClick={() => {
                          if (maxByGold > 0) setQuantities((prev) => ({ ...prev, [def.id]: maxByGold }));
                        }}
                      >
                        Max
                      </Button>
                      <Button
                        size="xs"
                        disabled={locked || qty <= 0 || qty * discountedCost > gold}
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
      </div>
    );
  };

  return (
    <Container size="lg">
      <Stack gap="md">
        <Title order={2}>Armory</Title>

        {/* Resource summary */}
        <OTCard>
          <Group justify="space-between" wrap="wrap" gap="md">
            <Stack gap={4}>
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Gold on Hand</Text>
              <Text fw={700} size="lg" className="ot-stat-value">{toLocale(gold)}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Armory Level</Text>
              <Text fw={700} size="lg" className="ot-stat-value">{armoryLevel}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Spy Academy Level</Text>
              <Text fw={700} size="lg" className="ot-stat-value">{spyAcademyLevel}</Text>
            </Stack>
            {pricesBonusLevel > 0 && (
              <Stack gap={4}>
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Price Discount</Text>
                <Text fw={700} size="lg" c="green">-{pricesBonusLevel}%</Text>
              </Stack>
            )}
          </Group>
        </OTCard>

        {/* Usage tabs */}
        <Tabs
          value={selectedUsage}
          onChange={(val) => {
            setSelectedUsage(val || ItemUsage.OFFENSE);
            setQuantities({});
          }}
        >
          <Tabs.List>
            {USAGE_ORDER.map((usage) => {
              const total = getTotalEquipped(usage);
              return (
                <Tabs.Tab key={usage} value={usage}>
                  {USAGE_LABELS[usage] || usage}
                  {total > 0 && (
                    <Badge size="xs" variant="light" ml={6}>{toLocale(total)}</Badge>
                  )}
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs>

        {/* Item tables by type */}
        <Paper withBorder p="md">
          <Title order={4} mb="sm">
            {USAGE_LABELS[selectedUsage]} Equipment
          </Title>
          {ITEM_TYPE_ORDER.map((type) => renderItemTable(type))}
        </Paper>
      </Stack>
    </Container>
  );
}
