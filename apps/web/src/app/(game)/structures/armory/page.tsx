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
  Progress,
  SimpleGrid,
  Tooltip,
} from '@mantine/core';
import { OTCard } from '@/components/ui';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { toLocale, getUnitByTypeAndLevel } from '@openthrone/game-logic';
import type { ItemDefinition } from '@openthrone/shared';
import { ItemUsage, ItemType, UnitType } from '@openthrone/shared';

interface ItemEntry {
  itemType: string;
  usage: string;
  level: number;
  quantity: number;
}

interface UnitEntry {
  unitType: string;
  level: number;
  quantity: number;
}

interface StatBreakdown {
  units: number;
  items: number;
  battleUpgrades: number;
  bonusPercent: number;
  bonusAmount: number;
  total: number;
}

interface DetailedStatBreakdown {
  statType: string;
  unitLines: Array<{ name: string; quantity: number; bonusEach: number; total: number }>;
  unitTotal: number;
  itemLines: Array<{ name: string; quantity: number; bonusEach: number; total: number }>;
  itemTotal: number;
  upgradeLines: Array<{ name: string; quantity: number; bonusEach: number; total: number }>;
  upgradeTotal: number;
  subtotal: number;
  bonusLines: Array<{ label: string; percent: number }>;
  bonusPercent: number;
  bonusAmount: number;
  total: number;
}

interface StatBreakdownResponse {
  offense: StatBreakdown;
  defense: StatBreakdown;
  spy: StatBreakdown;
  sentry: StatBreakdown;
  detailed: {
    offense: DetailedStatBreakdown;
    defense: DetailedStatBreakdown;
    spy: DetailedStatBreakdown;
    sentry: DetailedStatBreakdown;
  };
}

interface ArmoryStatus {
  gold: string;
  goldInBank: string;
  armoryLevel: number;
  spyAcademyLevel: number;
  pricesBonusLevel: number;
  playerRace: string;
  items: ItemEntry[];
  units: UnitEntry[];
  stats: {
    offense: number;
    defense: number;
    spy: number;
    sentry: number;
  };
  itemDefinitions: ItemDefinition[];
}

// Stat tooltip component
function StatTooltipContent({
  label,
  bd,
  detailed
}: {
  label: string;
  bd: StatBreakdown;
  detailed?: DetailedStatBreakdown;
}) {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={700}>{label} Breakdown</Text>
      <Text size="xs">Units: {toLocale(bd.units)}</Text>
      <Text size="xs">Items (equipped): {toLocale(bd.items)}</Text>
      <Text size="xs">Battle Upgrades: {toLocale(bd.battleUpgrades)}</Text>
      <Text size="xs" style={{ color: 'var(--ot-text-dim)', fontStyle: 'italic' }} mt={4}>
        Each unit equips 1 weapon + 1 armor
      </Text>
      {detailed?.bonusLines && detailed.bonusLines.length > 0 ? (
        <>
          <Text size="xs" fw={600} mt={4}>Bonus Sources (+{bd.bonusPercent}%):</Text>
          {detailed.bonusLines.map((bl, i) => (
            <Text size="xs" key={i} pl={8}>
              {bl.label}: +{bl.percent}%
            </Text>
          ))}
          <Text size="xs">= {toLocale(bd.bonusAmount)} bonus</Text>
        </>
      ) : (
        <Text size="xs">Bonus: +{bd.bonusPercent}% ({toLocale(bd.bonusAmount)})</Text>
      )}
      <Text size="xs" fw={600}>Total: {toLocale(bd.total)}</Text>
    </Stack>
  );
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

const STAT_COLORS: Record<string, string> = {
  OFFENSE: 'red',
  DEFENSE: 'blue',
  SPY: 'grape',
  SENTRY: 'teal',
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

/** Maps usage to the unit type it equips */
const USAGE_TO_UNIT: Record<string, string> = {
  OFFENSE: UnitType.OFFENSE,
  DEFENSE: UnitType.DEFENSE,
  SPY: UnitType.SPY,
  SENTRY: UnitType.SENTRY,
};

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

  const { data: breakdown } = useQuery<StatBreakdownResponse>({
    queryKey: ['player', 'stat-breakdown'],
    queryFn: () => api.get('/player/me/stat-breakdown'),
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

  /** Total items of a given usage and item type */
  const getTotalByUsageAndType = (usage: string, itemType: string): number =>
    status.items
      .filter((i) => i.usage === usage && i.itemType === itemType)
      .reduce((sum, i) => sum + i.quantity, 0);

  /** Total units of a given unit type */
  const getTotalUnits = (unitType: string): number =>
    status.units
      .filter((u) => u.unitType === unitType)
      .reduce((sum, u) => sum + u.quantity, 0);

  const getDiscountedCost = (cost: number) =>
    cost - Math.ceil((pricesBonusLevel / 100) * cost);

  const getBuildingLevel = (usage: string): number =>
    usage === ItemUsage.SPY || usage === ItemUsage.SENTRY
      ? spyAcademyLevel
      : armoryLevel;

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

  // ── Coverage calculations for selected usage ──
  const unitType = USAGE_TO_UNIT[selectedUsage] || '';
  const totalUnits = getTotalUnits(unitType);
  const totalWeapons = getTotalByUsageAndType(selectedUsage, ItemType.WEAPON);
  const totalArmor = getTotalByUsageAndType(selectedUsage, ItemType.ARMOR);
  const weaponCoverage = totalUnits > 0 ? Math.min(100, Math.round((totalWeapons / totalUnits) * 100)) : 0;
  const armorCoverage = totalUnits > 0 ? Math.min(100, Math.round((totalArmor / totalUnits) * 100)) : 0;
  const unitsWithoutWeapons = Math.max(0, totalUnits - totalWeapons);
  const unitsWithoutArmor = Math.max(0, totalUnits - totalArmor);

  // Unit breakdown by tier for selected usage
  const unitBreakdown = status.units
    .filter((u) => u.unitType === unitType && u.quantity > 0)
    .map((u) => {
      const def = getUnitByTypeAndLevel(u.unitType as UnitType, u.level);
      return { name: def?.name ?? `${u.unitType} Lv${u.level}`, level: u.level, quantity: u.quantity };
    })
    .sort((a, b) => b.level - a.level);

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

        {/* ── Live Stats + Gold Panel ──────────────────── */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <OTCard>
            <Stack gap="sm">
              <Tooltip
                label="Each unit equips 1 weapon + 1 armor. Best items are equipped first. Unused items give no bonus."
                multiline
                w={220}
                withArrow
              >
                <Text
                  size="xs"
                  fw={600}
                  tt="uppercase"
                  style={{ color: 'var(--ot-text-dim)', letterSpacing: '0.05em', cursor: 'help', textDecoration: 'underline dotted' }}
                >
                  Combat Stats
                </Text>
              </Tooltip>
              <SimpleGrid cols={2} spacing="xs">
                {USAGE_ORDER.map((usage) => {
                  const statKey = usage.toLowerCase() as 'offense' | 'defense' | 'spy' | 'sentry';
                  const val = status.stats[statKey];
                  const bd = breakdown?.[statKey];
                  const det = breakdown?.detailed?.[statKey];

                  const tooltipContent = bd ? (
                    <StatTooltipContent label={USAGE_LABELS[usage] || usage} bd={bd} detailed={det} />
                  ) : (
                    <Text size="xs">{USAGE_LABELS[usage] || usage}: {toLocale(val)}</Text>
                  );

                  return (
                    <Tooltip
                      key={usage}
                      label={tooltipContent}
                      withArrow
                    >
                      <Paper p="xs" withBorder style={{ cursor: 'help' }}>
                        <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>{USAGE_LABELS[usage]}</Text>
                        <Text fw={700} size="lg" style={{ color: `var(--mantine-color-${STAT_COLORS[usage]}-6)` }}>
                          {toLocale(val)}
                        </Text>
                      </Paper>
                    </Tooltip>
                  );
                })}
              </SimpleGrid>
            </Stack>
          </OTCard>

          <OTCard>
            <Stack gap="sm">
              <Text size="xs" fw={600} tt="uppercase" style={{ color: 'var(--ot-text-dim)', letterSpacing: '0.05em' }}>
                Resources & Buildings
              </Text>
              <SimpleGrid cols={2} spacing="xs">
                <Paper p="xs" withBorder>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Gold on Hand</Text>
                  <Text fw={700} size="lg" className="ot-stat-value">{toLocale(gold)}</Text>
                </Paper>
                <Paper p="xs" withBorder>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Armory Level</Text>
                  <Text fw={700} size="lg" className="ot-stat-value">{armoryLevel}</Text>
                </Paper>
                <Paper p="xs" withBorder>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Spy Academy</Text>
                  <Text fw={700} size="lg" className="ot-stat-value">{spyAcademyLevel}</Text>
                </Paper>
                {pricesBonusLevel > 0 ? (
                  <Paper p="xs" withBorder>
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Price Discount</Text>
                    <Text fw={700} size="lg" c="green">-{pricesBonusLevel}%</Text>
                  </Paper>
                ) : (
                  <Paper p="xs" withBorder>
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Price Discount</Text>
                    <Text fw={700} size="lg" className="ot-stat-value">None</Text>
                  </Paper>
                )}
              </SimpleGrid>
            </Stack>
          </OTCard>
        </SimpleGrid>

        {/* ── Usage Tabs ──────────────────────────────── */}
        <Tabs
          value={selectedUsage}
          onChange={(val) => {
            setSelectedUsage(val || ItemUsage.OFFENSE);
            setQuantities({});
          }}
        >
          <Tabs.List>
            {USAGE_ORDER.map((usage) => {
              const ut = USAGE_TO_UNIT[usage] || '';
              const unitCount = getTotalUnits(ut);
              const itemCount = getTotalEquipped(usage);
              return (
                <Tabs.Tab key={usage} value={usage}>
                  {USAGE_LABELS[usage] || usage}
                  <Badge size="xs" variant="light" ml={6}>
                    {toLocale(unitCount)} unit{unitCount !== 1 ? 's' : ''}
                  </Badge>
                  {itemCount > 0 && (
                    <Badge size="xs" variant="light" color="green" ml={4}>
                      {toLocale(itemCount)} items
                    </Badge>
                  )}
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs>

        {/* ── Equipment Coverage Panel ────────────────── */}
        <OTCard>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={600} size="sm">{USAGE_LABELS[selectedUsage]} Equipment Coverage</Text>
              <Badge variant="light" color={STAT_COLORS[selectedUsage]}>
                {toLocale(totalUnits)} {USAGE_LABELS[selectedUsage]} Units
              </Badge>
            </Group>

            {totalUnits === 0 ? (
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                No {USAGE_LABELS[selectedUsage]?.toLowerCase()} units trained. Train units first to equip them.
              </Text>
            ) : (
              <>
                {/* Unit breakdown by tier */}
                {unitBreakdown.length > 0 && (
                  <Group gap="xs" wrap="wrap">
                    {unitBreakdown.map((u) => (
                      <Badge key={u.level} variant="outline" size="sm" color={STAT_COLORS[selectedUsage]}>
                        {toLocale(u.quantity)} {u.name}
                      </Badge>
                    ))}
                  </Group>
                )}

                {/* Weapon coverage bar */}
                <Stack gap={4}>
                  <Group justify="space-between">
                    <Text size="xs" fw={500}>Weapons</Text>
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                      {toLocale(totalWeapons)} / {toLocale(totalUnits)} ({weaponCoverage}%)
                    </Text>
                  </Group>
                  <Progress
                    value={weaponCoverage}
                    color={weaponCoverage >= 100 ? 'green' : weaponCoverage >= 50 ? 'yellow' : 'red'}
                    size="md"
                    radius="xl"
                  />
                  {unitsWithoutWeapons > 0 && (
                    <Text size="xs" style={{ color: 'var(--ot-warning)' }}>
                      {toLocale(unitsWithoutWeapons)} unit{unitsWithoutWeapons !== 1 ? 's' : ''} without weapons
                    </Text>
                  )}
                </Stack>

                {/* Armor coverage bar */}
                <Stack gap={4}>
                  <Group justify="space-between">
                    <Text size="xs" fw={500}>Armor</Text>
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                      {toLocale(totalArmor)} / {toLocale(totalUnits)} ({armorCoverage}%)
                    </Text>
                  </Group>
                  <Progress
                    value={armorCoverage}
                    color={armorCoverage >= 100 ? 'green' : armorCoverage >= 50 ? 'yellow' : 'red'}
                    size="md"
                    radius="xl"
                  />
                  {unitsWithoutArmor > 0 && (
                    <Text size="xs" style={{ color: 'var(--ot-warning)' }}>
                      {toLocale(unitsWithoutArmor)} unit{unitsWithoutArmor !== 1 ? 's' : ''} without armor
                    </Text>
                  )}
                </Stack>
              </>
            )}
          </Stack>
        </OTCard>

        {/* ── Item Tables by Type ─────────────────────── */}
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
