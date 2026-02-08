'use client';

import {
  Container,
  Title,
  Paper,
  Group,
  Stack,
  Text,
  Button,
  Table,
  Skeleton,
  Alert,
  Tabs,
  Badge,
  Progress,
  SimpleGrid,
  NumberInput,
} from '@mantine/core';
import { OTCard } from '@/components/ui';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { toLocale } from '@openthrone/game-logic';
import { StructureUpgradeType } from '@openthrone/shared';

interface FortStatus {
  level: number;
  name: string;
  hitpoints: number;
  maxHitpoints: number;
  costPerRepairPoint: number;
  goldPerTurn: number;
  defenseBonusPercentage: number;
}

interface StructuresStatus {
  gold: string;
  goldInBank: string;
  playerLevel: number;
  fort: FortStatus;
  upgrades: {
    economy: number;
    house: number;
    offense: number;
    spy: number;
    sentry: number;
    armory: number;
    mercenaryCamp: number;
  };
  definitions: {
    fortifications: any[];
    economy: any[];
    house: any[];
    offense: any[];
    spy: any[];
    sentry: any[];
    armory: any[];
    mercenaryCamp: any[];
  };
}

interface MercStockItem {
  unitType: string;
  unitName: string;
  available: number;
  total: number;
  purchased: number;
  cost: number;
  baseCost: number;
}

interface MercenaryStatus {
  campLevel: number;
  campName: string;
  nextUpgrade: { name: string; cost: number; fortLevel: number; dailyStock: number } | null;
  stock: MercStockItem[];
}

type UpgradeTab = 'FORT' | 'ECONOMY' | 'HOUSE' | 'OFFENSE' | 'SPY' | 'SENTRY' | 'ARMORY' | 'MERCENARY';

const TAB_LABELS: Record<UpgradeTab, string> = {
  FORT: 'Fortification',
  ECONOMY: 'Economy',
  HOUSE: 'Housing',
  OFFENSE: 'Offense',
  SPY: 'Spy',
  SENTRY: 'Sentry',
  ARMORY: 'Armory',
  MERCENARY: 'Mercenary Camp',
};

export default function StructureUpgradesPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState<UpgradeTab>('FORT');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mercQuantities, setMercQuantities] = useState<Record<string, number>>({});

  const { data: status, isLoading } = useQuery<StructuresStatus>({
    queryKey: ['structures', 'status'],
    queryFn: () => api.get('/structures/status'),
    enabled: isReady,
  });

  const { data: mercStatus } = useQuery<MercenaryStatus>({
    queryKey: ['structures', 'mercenary'],
    queryFn: () => api.get('/structures/mercenary'),
    enabled: isReady,
  });

  const upgradeMutation = useMutation({
    mutationFn: (upgradeType: string) =>
      api.post('/structures/upgrade', { upgradeType }),
    onSuccess: (data: any) => {
      setError(null);
      setSuccess(`Upgraded to level ${data.newLevel}!`);
      queryClient.invalidateQueries({ queryKey: ['structures'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const buyMercMutation = useMutation({
    mutationFn: (units: Array<{ unitType: string; quantity: number }>) =>
      api.post('/structures/mercenary/buy', { units }),
    onSuccess: () => {
      setError(null);
      setSuccess('Mercenaries hired successfully!');
      setMercQuantities({});
      queryClient.invalidateQueries({ queryKey: ['structures'] });
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

  const getCurrentLevel = (tab: UpgradeTab): number => {
    switch (tab) {
      case 'FORT': return status.fort.level;
      case 'ECONOMY': return status.upgrades.economy;
      case 'HOUSE': return status.upgrades.house;
      case 'OFFENSE': return status.upgrades.offense;
      case 'SPY': return status.upgrades.spy;
      case 'SENTRY': return status.upgrades.sentry;
      case 'ARMORY': return status.upgrades.armory;
      case 'MERCENARY': return status.upgrades.mercenaryCamp;
      default: return 1;
    }
  };

  const getDefinitions = (tab: UpgradeTab): any[] => {
    switch (tab) {
      case 'FORT': return status.definitions.fortifications;
      case 'ECONOMY': return status.definitions.economy;
      case 'HOUSE': return status.definitions.house;
      case 'OFFENSE': return status.definitions.offense;
      case 'SPY': return status.definitions.spy;
      case 'SENTRY': return status.definitions.sentry;
      case 'ARMORY': return status.definitions.armory;
      case 'MERCENARY': return status.definitions.mercenaryCamp;
      default: return [];
    }
  };

  const getUpgradeType = (tab: UpgradeTab): string => {
    switch (tab) {
      case 'FORT': return StructureUpgradeType.FORT;
      case 'ECONOMY': return StructureUpgradeType.ECONOMY;
      case 'HOUSE': return StructureUpgradeType.HOUSE;
      case 'OFFENSE': return StructureUpgradeType.OFFENSE;
      case 'SPY': return StructureUpgradeType.SPY;
      case 'SENTRY': return StructureUpgradeType.SENTRY;
      case 'ARMORY': return StructureUpgradeType.ARMORY;
      case 'MERCENARY': return StructureUpgradeType.MERCENARY_CAMP;
      default: return tab;
    }
  };

  const getRequirementLabel = (def: any, tab: UpgradeTab): string | null => {
    if (tab === 'FORT' && def.levelRequirement > 0) {
      return `Player Lv ${def.levelRequirement}`;
    }
    if (def.fortLevelRequirement) return `Fort Lv ${def.fortLevelRequirement}`;
    if (def.fortLevel) return `Fort Lv ${def.fortLevel}`;
    return null;
  };

  const meetsRequirement = (def: any, tab: UpgradeTab): boolean => {
    if (tab === 'FORT') {
      return status.playerLevel >= (def.levelRequirement ?? 0);
    }
    const reqFort = def.fortLevelRequirement ?? def.fortLevel ?? 0;
    return status.fort.level >= reqFort;
  };

  const getBonusLabel = (def: any, tab: UpgradeTab): string => {
    if (tab === 'FORT') return `+${def.defenseBonusPercentage}% defense`;
    if (tab === 'ECONOMY') return `${def.goldPerWorker} gold/worker`;
    if (tab === 'HOUSE') return `${def.citizensDaily} citizens/day`;
    if (tab === 'OFFENSE') return `+${def.offenseBonusPercentage}%`;
    if (tab === 'SPY') return `+${def.offenseBonusPercentage}%`;
    if (tab === 'SENTRY') return `+${def.defenseBonusPercentage}%`;
    if (tab === 'ARMORY') return '-';
    if (tab === 'MERCENARY') return `${def.dailyStock} mercs/day`;
    return '';
  };

  const currentLevel = getCurrentLevel(selectedTab);
  const definitions = getDefinitions(selectedTab);
  const nextDef = definitions.find((d) => d.level === currentLevel + 1);

  return (
    <Container size="md">
      <Stack gap="md">
        <Title order={2}>Structure Upgrades</Title>

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

        <OTCard>
          <Group justify="space-between" wrap="wrap" gap="md">
            <Stack gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Gold on Hand</Text>
              <Text fw={700} size="lg" className="ot-stat-value">{toLocale(gold)}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Fort Level</Text>
              <Text fw={700} size="lg">{status.fort.level} - {status.fort.name}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Player Level</Text>
              <Text fw={700} size="lg">{status.playerLevel}</Text>
            </Stack>
          </Group>
        </OTCard>

        {/* Fort health bar */}
        <Paper withBorder p="md">
          <Group justify="space-between" mb={4}>
            <Text size="sm" fw={500}>Fortification Health</Text>
            <Text size="sm">{toLocale(status.fort.hitpoints)} / {toLocale(status.fort.maxHitpoints)}</Text>
          </Group>
          <Progress
            value={(status.fort.hitpoints / status.fort.maxHitpoints) * 100}
            color={status.fort.hitpoints < status.fort.maxHitpoints ? 'orange' : 'green'}
            size="lg"
          />
        </Paper>

        <Tabs
          value={selectedTab}
          onChange={(val) => {
            setSelectedTab(val as UpgradeTab);
            setError(null);
            setSuccess(null);
          }}
        >
          <Tabs.List>
            {(Object.keys(TAB_LABELS) as UpgradeTab[]).map((tab) => (
              <Tabs.Tab key={tab} value={tab}>
                {TAB_LABELS[tab]}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        <Paper withBorder p="md">
          <Title order={4} mb="sm">{TAB_LABELS[selectedTab]} Upgrades</Title>

          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Lv</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th ta="right">Cost</Table.Th>
                <Table.Th ta="center">Bonus</Table.Th>
                <Table.Th ta="center">Requires</Table.Th>
                <Table.Th ta="center">Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {definitions.map((def) => {
                const isCurrentLevel = def.level === currentLevel;
                const isNextLevel = def.level === currentLevel + 1;
                const isPast = def.level <= currentLevel;
                const requirementMet = meetsRequirement(def, selectedTab);
                const canAfford = gold >= def.cost;
                const requirementLabel = getRequirementLabel(def, selectedTab);

                return (
                  <Table.Tr
                    key={def.level}
                    style={
                      isCurrentLevel
                        ? { backgroundColor: 'var(--mantine-color-blue-light)' }
                        : !isPast && !requirementMet
                          ? { opacity: 0.5 }
                          : undefined
                    }
                  >
                    <Table.Td>{def.level}</Table.Td>
                    <Table.Td>
                      {def.name}
                      {isCurrentLevel && (
                        <Badge color="blue" size="xs" ml="xs">Current</Badge>
                      )}
                    </Table.Td>
                    <Table.Td ta="right">
                      {def.cost === 0 ? 'Free' : toLocale(def.cost)}
                    </Table.Td>
                    <Table.Td ta="center">{getBonusLabel(def, selectedTab)}</Table.Td>
                    <Table.Td ta="center">
                      {requirementLabel ? (
                        <Badge
                          color={requirementMet ? 'green' : 'red'}
                          size="xs"
                          variant="light"
                        >
                          {requirementLabel}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </Table.Td>
                    <Table.Td ta="center">
                      {isPast && !isCurrentLevel && (
                        <Badge color="gray" size="xs">Done</Badge>
                      )}
                      {isNextLevel && (
                        <Button
                          size="xs"
                          variant="light"
                          disabled={!requirementMet || !canAfford}
                          loading={upgradeMutation.isPending}
                          onClick={() => {
                            setError(null);
                            setSuccess(null);
                            upgradeMutation.mutate(getUpgradeType(selectedTab));
                          }}
                        >
                          Upgrade ({toLocale(def.cost)})
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>

        {/* Mercenary Hire Panel — only shown on Mercenary tab when camp is built */}
        {selectedTab === 'MERCENARY' && mercStatus && mercStatus.campLevel > 1 && (
          <Paper withBorder p="md">
            <Title order={4} mb="sm">Hire Mercenaries</Title>
            <Text size="sm" mb="md" style={{ color: 'var(--ot-text-dim)' }}>
              Pre-trained T1 units at 1.5x cost — no citizens required. Stock resets daily at midnight.
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {mercStatus.stock.map((item) => (
                <OTCard key={item.unitType}>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text fw={700}>{item.unitName}</Text>
                      <Badge variant="light" color={item.unitType === 'OFFENSE' || item.unitType === 'DEFENSE' ? 'blue' : 'grape'} size="sm">
                        {item.unitType}
                      </Badge>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                        Available: {item.available} / {item.total}
                      </Text>
                    </Group>
                    <Progress
                      value={item.total > 0 ? ((item.total - item.available) / item.total) * 100 : 0}
                      color={item.available > 0 ? 'green' : 'red'}
                      size="sm"
                    />
                    <Group justify="space-between" wrap="nowrap">
                      <Stack gap={2}>
                        <Text size="sm" fw={600}>{toLocale(item.cost)} gold each</Text>
                        <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                          1.5x premium (base: {toLocale(item.baseCost)})
                        </Text>
                      </Stack>
                    </Group>
                    <Group gap="sm" align="flex-end">
                      <NumberInput
                        label="Quantity"
                        min={1}
                        max={item.available}
                        value={mercQuantities[item.unitType] ?? ''}
                        onChange={(val) =>
                          setMercQuantities((prev) => ({
                            ...prev,
                            [item.unitType]: typeof val === 'number' ? val : 0,
                          }))
                        }
                        style={{ flex: 1 }}
                        size="sm"
                        disabled={item.available <= 0}
                      />
                      <Button
                        size="sm"
                        color="yellow"
                        disabled={
                          item.available <= 0 ||
                          !mercQuantities[item.unitType] ||
                          (mercQuantities[item.unitType] ?? 0) <= 0 ||
                          gold < item.cost * (mercQuantities[item.unitType] ?? 0)
                        }
                        loading={buyMercMutation.isPending}
                        onClick={() => {
                          const qty = mercQuantities[item.unitType];
                          if (!qty || qty <= 0) return;
                          setError(null);
                          setSuccess(null);
                          buyMercMutation.mutate([{ unitType: item.unitType, quantity: qty }]);
                        }}
                      >
                        Hire
                      </Button>
                    </Group>
                    {(mercQuantities[item.unitType] ?? 0) > 0 && (
                      <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                        Total: {toLocale(item.cost * (mercQuantities[item.unitType] ?? 0))} gold
                      </Text>
                    )}
                  </Stack>
                </OTCard>
              ))}
            </SimpleGrid>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
