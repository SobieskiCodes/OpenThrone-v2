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
} from '@mantine/core';
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
  };
  definitions: {
    fortifications: any[];
    economy: any[];
    house: any[];
    offense: any[];
    spy: any[];
    sentry: any[];
    armory: any[];
  };
}

type UpgradeTab = 'FORT' | 'ECONOMY' | 'OFFENSE' | 'SPY' | 'SENTRY' | 'ARMORY';

const TAB_LABELS: Record<UpgradeTab, string> = {
  FORT: 'Fortification',
  ECONOMY: 'Economy',
  OFFENSE: 'Offense',
  SPY: 'Spy',
  SENTRY: 'Sentry',
  ARMORY: 'Armory',
};

export default function StructureUpgradesPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState<UpgradeTab>('FORT');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      case 'FORT': return status.fort.level;
      case 'ECONOMY': return status.upgrades.economy;
      case 'OFFENSE': return status.upgrades.offense;
      case 'SPY': return status.upgrades.spy;
      case 'SENTRY': return status.upgrades.sentry;
      case 'ARMORY': return status.upgrades.armory;
      default: return 1;
    }
  };

  const getDefinitions = (tab: UpgradeTab): any[] => {
    switch (tab) {
      case 'FORT': return status.definitions.fortifications;
      case 'ECONOMY': return status.definitions.economy;
      case 'OFFENSE': return status.definitions.offense;
      case 'SPY': return status.definitions.spy;
      case 'SENTRY': return status.definitions.sentry;
      case 'ARMORY': return status.definitions.armory;
      default: return [];
    }
  };

  const getUpgradeType = (tab: UpgradeTab): string => {
    switch (tab) {
      case 'FORT': return StructureUpgradeType.FORT;
      case 'ECONOMY': return StructureUpgradeType.ECONOMY;
      case 'OFFENSE': return StructureUpgradeType.OFFENSE;
      case 'SPY': return StructureUpgradeType.SPY;
      case 'SENTRY': return StructureUpgradeType.SENTRY;
      case 'ARMORY': return StructureUpgradeType.ARMORY;
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
    if (tab === 'OFFENSE') return `+${def.offenseBonusPercentage}%`;
    if (tab === 'SPY') return `+${def.offenseBonusPercentage}%`;
    if (tab === 'SENTRY') return `+${def.defenseBonusPercentage}%`;
    if (tab === 'ARMORY') return '-';
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

        <Paper withBorder p="md">
          <Group justify="space-between">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Gold on Hand</Text>
              <Text fw={700} size="lg">{toLocale(gold)}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Fort Level</Text>
              <Text fw={700} size="lg">{status.fort.level} - {status.fort.name}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Player Level</Text>
              <Text fw={700} size="lg">{status.playerLevel}</Text>
            </Stack>
          </Group>
        </Paper>

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
      </Stack>
    </Container>
  );
}
