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
} from '@mantine/core';
import { OTCard } from '@/components/ui';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { toLocale } from '@openthrone/game-logic';
import { StructureUpgradeType } from '@openthrone/shared';

interface StructuresStatus {
  gold: string;
  goldInBank: string;
  playerLevel: number;
  fort: {
    level: number;
    name: string;
    hitpoints: number;
    maxHitpoints: number;
    costPerRepairPoint: number;
    goldPerTurn: number;
    defenseBonusPercentage: number;
  };
  upgrades: {
    offense: number;
    spy: number;
    sentry: number;
  };
  definitions: {
    offense: any[];
    spy: any[];
    sentry: any[];
    [key: string]: any;
  };
}

type UpgradeTab = 'OFFENSE' | 'SPY' | 'SENTRY';

const TAB_LABELS: Record<UpgradeTab, string> = {
  OFFENSE: 'Offense',
  SPY: 'Spy',
  SENTRY: 'Sentry',
};

export default function StructureUpgradesPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState<UpgradeTab>('OFFENSE');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Refresh nav badge on mount so it reflects current gold
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['player', 'me'] });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: status, isLoading } = useQuery<StructuresStatus>({
    queryKey: ['structures', 'status'],
    queryFn: () => api.get('/structures/status'),
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
      case 'OFFENSE': return status.upgrades.offense;
      case 'SPY': return status.upgrades.spy;
      case 'SENTRY': return status.upgrades.sentry;
      default: return 1;
    }
  };

  const getDefinitions = (tab: UpgradeTab): any[] => {
    switch (tab) {
      case 'OFFENSE': return status.definitions.offense;
      case 'SPY': return status.definitions.spy;
      case 'SENTRY': return status.definitions.sentry;
      default: return [];
    }
  };

  const getUpgradeType = (tab: UpgradeTab): string => {
    switch (tab) {
      case 'OFFENSE': return StructureUpgradeType.OFFENSE;
      case 'SPY': return StructureUpgradeType.SPY;
      case 'SENTRY': return StructureUpgradeType.SENTRY;
      default: return tab;
    }
  };

  const getRequirementLabel = (def: any): string | null => {
    if (def.fortLevelRequirement) return `Fort Lv ${def.fortLevelRequirement}`;
    if (def.fortLevel) return `Fort Lv ${def.fortLevel}`;
    return null;
  };

  const meetsRequirement = (def: any): boolean => {
    const reqFort = def.fortLevelRequirement ?? def.fortLevel ?? 0;
    return status.fort.level >= reqFort;
  };

  const getBonusLabel = (def: any, tab: UpgradeTab): string => {
    if (tab === 'OFFENSE') return `+${def.offenseBonusPercentage}%`;
    if (tab === 'SPY') return `+${def.offenseBonusPercentage}%`;
    if (tab === 'SENTRY') return `+${def.defenseBonusPercentage}%`;
    return '';
  };

  // Per-tab upgrade info -- "unlocked" means requirements met (regardless of gold)
  const getTabUpgradeInfo = (tab: UpgradeTab) => {
    const lvl = getCurrentLevel(tab);
    const defs = getDefinitions(tab);
    const next = defs.find((d: any) => d.level === lvl + 1);
    if (!next) return { status: 'maxed' as const };
    const reqMet = meetsRequirement(next);
    return {
      status: reqMet ? ('unlocked' as const) : ('locked' as const),
    };
  };

  const tabInfoMap = Object.fromEntries(
    (Object.keys(TAB_LABELS) as UpgradeTab[]).map((tab) => [tab, getTabUpgradeInfo(tab)]),
  ) as Record<UpgradeTab, ReturnType<typeof getTabUpgradeInfo>>;

  const currentLevel = getCurrentLevel(selectedTab);
  const definitions = getDefinitions(selectedTab);

  return (
    <Container size="md">
      <Stack gap="md">
        <Title order={2}>Proficiency Upgrades</Title>

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
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Player Level</Text>
              <Text fw={700} size="lg">{status.playerLevel}</Text>
            </Stack>
          </Group>
        </OTCard>

        <Tabs
          value={selectedTab}
          onChange={(val) => {
            setSelectedTab(val as UpgradeTab);
            setError(null);
            setSuccess(null);
          }}
        >
          <Tabs.List>
            {(Object.keys(TAB_LABELS) as UpgradeTab[]).map((tab) => {
              const info = tabInfoMap[tab];
              return (
                <Tabs.Tab
                  key={tab}
                  value={tab}
                  rightSection={
                    info.status === 'unlocked' ? (
                      <Badge size="xs" circle color="red" variant="filled" className="ot-badge-pulse">!</Badge>
                    ) : null
                  }
                  style={
                    info.status === 'unlocked'
                      ? { color: 'var(--ot-success)', fontWeight: 700 }
                      : info.status === 'maxed'
                        ? { opacity: 0.5 }
                        : undefined
                  }
                >
                  {TAB_LABELS[tab]}
                </Tabs.Tab>
              );
            })}
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
                const requirementMet = meetsRequirement(def);
                const canAfford = gold >= def.cost;
                const requirementLabel = getRequirementLabel(def);

                const isUnlocked = isNextLevel && requirementMet;

                return (
                  <Table.Tr
                    key={def.level}
                    style={
                      isUnlocked
                        ? { backgroundColor: 'rgba(64, 192, 87, 0.12)', outline: '1px solid var(--ot-success)' }
                        : isCurrentLevel
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
                      <Text
                        size="sm"
                        span
                        fw={isUnlocked ? 600 : undefined}
                        style={isUnlocked && !canAfford ? { color: 'var(--ot-danger)' } : undefined}
                      >
                        {def.cost === 0 ? 'Free' : toLocale(def.cost)}
                      </Text>
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
      </Stack>
    </Container>
  );
}
