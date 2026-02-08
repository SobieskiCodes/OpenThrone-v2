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
} from '@mantine/core';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { toLocale } from '@openthrone/game-logic';
import { BattleUpgradeType } from '@openthrone/shared';

interface BattleUpgradeDef {
  type: string;
  name: string;
  siegeUpgradeLevel: number;
  level: number;
  bonus: number;
  cost: number;
  unitsCovered: number;
  minUnitLevel: number;
  killingStrength: number;
  defenseStrength: number;
}

interface OwnedBattleUpgrade {
  upgradeType: string;
  level: number;
  quantity: number;
}

interface StructuresStatus {
  gold: string;
  upgrades: {
    offense: number;
  };
  battleUpgrades: OwnedBattleUpgrade[];
  definitions: {
    battle: BattleUpgradeDef[];
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

export default function BattleUpgradesPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<string>(BattleUpgradeType.OFFENSE);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery<StructuresStatus>({
    queryKey: ['structures', 'status'],
    queryFn: () => api.get('/structures/status'),
    enabled: isReady,
  });

  const purchaseMutation = useMutation({
    mutationFn: (data: { upgradeType: string; quantity: number }) =>
      api.post('/structures/battle-upgrade', data),
    onSuccess: () => {
      setError(null);
      setSuccess('Battle upgrade purchased!');
      setQuantities({});
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
          <Skeleton height={300} />
        </Stack>
      </Container>
    );
  }

  const gold = Number(status.gold);
  const offenseLevel = status.upgrades.offense;

  const getOwned = (type: string): OwnedBattleUpgrade | undefined =>
    status.battleUpgrades.find((bu) => bu.upgradeType === type);

  const getDefsForType = (type: string): BattleUpgradeDef[] =>
    status.definitions.battle.filter((d) => d.type === type);

  const defs = getDefsForType(selectedType);

  return (
    <Container size="md">
      <Stack gap="md">
        <Title order={2}>Battle Upgrades</Title>

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

        <Paper withBorder p="md" className="ot-card">
          <Group justify="space-between" wrap="wrap" gap="md">
            <Stack gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Gold on Hand</Text>
              <Text fw={700} size="lg" className="ot-stat-value">{toLocale(gold)}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Offense Upgrade Level</Text>
              <Text fw={700} size="lg">{offenseLevel}</Text>
            </Stack>
          </Group>
        </Paper>

        <Tabs
          value={selectedType}
          onChange={(val) => {
            setSelectedType(val || BattleUpgradeType.OFFENSE);
            setQuantities({});
            setError(null);
            setSuccess(null);
          }}
        >
          <Tabs.List>
            {TYPE_ORDER.map((type) => (
              <Tabs.Tab key={type} value={type}>
                {TYPE_LABELS[type] || type}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        <Paper withBorder p="md">
          <Title order={4} mb="sm">{TYPE_LABELS[selectedType] || selectedType} Battle Upgrades</Title>
          <Text size="xs" style={{ color: 'var(--ot-text-dim)' }} mb="sm">
            Battle upgrades boost your units in combat. Each covers a number of units.
          </Text>

          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th ta="center">Lv</Table.Th>
                <Table.Th ta="right">Cost</Table.Th>
                <Table.Th ta="center">Bonus</Table.Th>
                <Table.Th ta="center">Units Covered</Table.Th>
                <Table.Th ta="center">Owned</Table.Th>
                <Table.Th ta="right">Qty</Table.Th>
                <Table.Th ta="center">Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {defs.map((def) => {
                const key = `${def.type}_${def.level}`;
                const owned = getOwned(def.type);
                const ownedQty = owned && owned.level >= def.level ? owned.quantity : 0;
                const locked = offenseLevel < def.siegeUpgradeLevel;
                const needsLowerLevel = def.level > 1 && (!owned || owned.level < 1);
                const qty = quantities[key] || 0;

                return (
                  <Table.Tr key={key} style={locked || needsLowerLevel ? { opacity: 0.5 } : undefined}>
                    <Table.Td>
                      {def.name}
                      {locked && (
                        <Badge color="red" size="xs" ml="xs">
                          Offense Lv {def.siegeUpgradeLevel}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td ta="center">{def.level}</Table.Td>
                    <Table.Td ta="right">{toLocale(def.cost)}</Table.Td>
                    <Table.Td ta="center">+{def.bonus}%</Table.Td>
                    <Table.Td ta="center">{def.unitsCovered}</Table.Td>
                    <Table.Td ta="center">{toLocale(ownedQty)}</Table.Td>
                    <Table.Td ta="right">
                      <NumberInput
                        size="xs"
                        min={0}
                        value={qty}
                        onChange={(val) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [key]: typeof val === 'number' ? val : 0,
                          }))
                        }
                        disabled={locked || needsLowerLevel}
                        w={80}
                        styles={{ input: { textAlign: 'right' } }}
                      />
                    </Table.Td>
                    <Table.Td ta="center">
                      <Button
                        size="xs"
                        variant="light"
                        disabled={locked || needsLowerLevel || qty <= 0 || def.cost * qty > gold}
                        loading={purchaseMutation.isPending}
                        onClick={() => {
                          setError(null);
                          setSuccess(null);
                          purchaseMutation.mutate({
                            upgradeType: def.type,
                            quantity: qty,
                          });
                        }}
                      >
                        Buy
                      </Button>
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
