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
  Alert,
  Badge,
  Tabs,
  Select,
} from '@mantine/core';
import { useState } from 'react';
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

const USAGE_ORDER = [
  ItemUsage.OFFENSE,
  ItemUsage.DEFENSE,
  ItemUsage.SPY,
  ItemUsage.SENTRY,
];

const ITEM_TYPE_LABELS: Record<string, string> = {
  WEAPON: 'Weapon',
  HELM: 'Helm',
  ARMOR: 'Armor',
  BOOTS: 'Boots',
  BRACERS: 'Bracers',
  SHIELD: 'Shield',
};

const ITEM_TYPE_ORDER = [
  ItemType.WEAPON,
  ItemType.HELM,
  ItemType.ARMOR,
  ItemType.BOOTS,
  ItemType.BRACERS,
  ItemType.SHIELD,
];

export default function ArmoryPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'equip' | 'unequip'>('equip');
  const [selectedUsage, setSelectedUsage] = useState<string>(ItemUsage.OFFENSE);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery<ArmoryStatus>({
    queryKey: ['armory', 'status'],
    queryFn: () => api.get('/armory/status'),
    enabled: isReady,
  });

  const equipMutation = useMutation({
    mutationFn: (item: { itemType: string; usage: string; level: number; quantity: number }) =>
      api.post('/armory/equip', item),
    onSuccess: () => {
      setError(null);
      setSuccess('Item equipped successfully!');
      setQuantities({});
      queryClient.invalidateQueries({ queryKey: ['armory'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const unequipMutation = useMutation({
    mutationFn: (item: { itemType: string; usage: string; level: number; quantity: number }) =>
      api.post('/armory/unequip', item),
    onSuccess: () => {
      setError(null);
      setSuccess('Item unequipped successfully! 75% gold refunded.');
      setQuantities({});
      queryClient.invalidateQueries({ queryKey: ['armory'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  if (isLoading || !status) {
    return (
      <Container size="md">
        <Stack gap="md">
          <Skeleton height={40} width={200} />
          <Skeleton height={100} />
          <Skeleton height={400} />
        </Stack>
      </Container>
    );
  }

  const gold = Number(status.gold);
  const { armoryLevel, pricesBonusLevel, playerRace } = status;

  const getOwnedQuantity = (itemType: string, usage: string, level: number): number => {
    const entry = status.items.find(
      (i) => i.itemType === itemType && i.usage === usage && i.level === level,
    );
    return entry?.quantity ?? 0;
  };

  const getKey = (def: ItemDefinition) => def.id;

  const getDiscountedCost = (cost: number) =>
    cost - Math.ceil((pricesBonusLevel / 100) * cost);

  const handleEquipItem = (def: ItemDefinition, qty: number) => {
    if (qty <= 0) return;
    setError(null);
    setSuccess(null);
    equipMutation.mutate({
      itemType: def.type,
      usage: def.usage,
      level: def.level,
      quantity: qty,
    });
  };

  const handleUnequipItem = (def: ItemDefinition, qty: number) => {
    if (qty <= 0) return;
    setError(null);
    setSuccess(null);
    unequipMutation.mutate({
      itemType: def.type,
      usage: def.usage,
      level: def.level,
      quantity: qty,
    });
  };

  const getFilteredDefs = (usage: string) => {
    return status.itemDefinitions.filter(
      (d) =>
        d.usage === usage &&
        (d.race === 'ALL' || d.race === playerRace),
    );
  };

  const renderItemTypeSection = (usage: string, itemType: ItemType) => {
    const defs = getFilteredDefs(usage).filter((d) => d.type === itemType);
    if (defs.length === 0) return null;

    return (
      <div key={`${usage}-${itemType}`}>
        <Text fw={600} size="sm" mt="sm" mb={4}>
          {ITEM_TYPE_LABELS[itemType] || itemType}
        </Text>
        <div className="ot-table-scroll">
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th ta="center">Lv</Table.Th>
              <Table.Th ta="right">Cost</Table.Th>
              <Table.Th ta="right">Bonus</Table.Th>
              <Table.Th ta="right">Owned</Table.Th>
              <Table.Th ta="right">Qty</Table.Th>
              <Table.Th ta="center">Action</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {defs.map((def) => {
              const key = getKey(def);
              const owned = getOwnedQuantity(def.type, def.usage, def.level);
              const locked = def.armoryLevel > armoryLevel;
              const discountedCost = getDiscountedCost(def.cost);
              const qty = quantities[key] || 0;

              return (
                <Table.Tr key={key} style={locked ? { opacity: 0.5 } : undefined}>
                  <Table.Td>
                    {def.name}
                    {locked && (
                      <Badge color="red" size="xs" ml="xs">
                        Armory Lv {def.armoryLevel}
                      </Badge>
                    )}
                    {def.race !== 'ALL' && (
                      <Badge color="blue" size="xs" ml="xs" variant="light">
                        {def.race}
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td ta="center">{def.level}</Table.Td>
                  <Table.Td ta="right">
                    {toLocale(discountedCost)}
                    {pricesBonusLevel > 0 && discountedCost < def.cost && (
                      <Text component="span" size="xs" c="green" ml={4}>
                        (-{pricesBonusLevel}%)
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td ta="right">+{def.bonus}%</Table.Td>
                  <Table.Td ta="right">{toLocale(owned)}</Table.Td>
                  <Table.Td ta="right">
                    <NumberInput
                      size="xs"
                      min={0}
                      max={mode === 'unequip' ? owned : undefined}
                      value={qty}
                      onChange={(val) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [key]: typeof val === 'number' ? val : 0,
                        }))
                      }
                      disabled={locked}
                      w={80}
                      styles={{ input: { textAlign: 'right' } }}
                    />
                  </Table.Td>
                  <Table.Td ta="center">
                    <Button
                      size="xs"
                      variant="light"
                      color={mode === 'equip' ? 'blue' : 'orange'}
                      disabled={
                        locked ||
                        qty <= 0 ||
                        (mode === 'equip' && discountedCost * qty > gold) ||
                        (mode === 'unequip' && qty > owned)
                      }
                      loading={equipMutation.isPending || unequipMutation.isPending}
                      onClick={() =>
                        mode === 'equip'
                          ? handleEquipItem(def, qty)
                          : handleUnequipItem(def, qty)
                      }
                    >
                      {mode === 'equip' ? 'Buy' : 'Sell'}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        </div>
      </div>
    );
  };

  return (
    <Container size="md">
      <Stack gap="md">
        <Title order={2}>Armory</Title>

        {error && (
          <Alert color="red" onClose={() => setError(null)} withCloseButton>
            {error}
          </Alert>
        )}
        {success && (
          <Alert color="green" onClose={() => setSuccess(null)} withCloseButton>
            {success}
          </Alert>
        )}

        {/* Resource summary */}
        <Paper withBorder p="md" className="ot-card">
          <Group justify="space-between" wrap="wrap" gap="md">
            <Stack gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Gold on Hand</Text>
              <Text fw={700} size="lg" className="ot-stat-value">{toLocale(gold)}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Gold in Bank</Text>
              <Text fw={700} size="lg" className="ot-stat-value">{toLocale(Number(status.goldInBank))}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Armory Level</Text>
              <Text fw={700} size="lg" className="ot-stat-value">{armoryLevel}</Text>
            </Stack>
          </Group>
        </Paper>

        {/* Mode + Usage selection */}
        <Group>
          <Tabs
            value={mode}
            onChange={(val) => {
              setMode(val as 'equip' | 'unequip');
              setQuantities({});
              setError(null);
              setSuccess(null);
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="equip">Equip (Buy)</Tabs.Tab>
              <Tabs.Tab value="unequip">Unequip (Sell)</Tabs.Tab>
            </Tabs.List>
          </Tabs>

          <Select
            value={selectedUsage}
            onChange={(val) => {
              setSelectedUsage(val || ItemUsage.OFFENSE);
              setQuantities({});
            }}
            data={USAGE_ORDER.map((u) => ({
              value: u,
              label: USAGE_LABELS[u] || u,
            }))}
            w={160}
          />
        </Group>

        {/* Item tables by type */}
        <Paper withBorder p="md" className="ot-card">
          <Title order={4} mb="sm">
            {USAGE_LABELS[selectedUsage] || selectedUsage} Items
          </Title>
          {mode === 'unequip' && (
            <Text size="xs" c="dimmed" mb="sm">
              Selling returns 75% of the purchase price.
            </Text>
          )}
          {ITEM_TYPE_ORDER.map((type) =>
            renderItemTypeSection(selectedUsage, type),
          )}
        </Paper>
      </Stack>
    </Container>
  );
}
