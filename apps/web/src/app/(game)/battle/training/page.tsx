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
import type { UnitDefinition } from '@openthrone/shared';
import { UnitType } from '@openthrone/shared';

interface UnitEntry {
  unitType: string;
  level: number;
  quantity: number;
}

interface TrainingStatus {
  gold: string;
  goldInBank: string;
  citizens: number;
  fortLevel: number;
  pricesBonusLevel: number;
  units: UnitEntry[];
  unitDefinitions: UnitDefinition[];
}

const UNIT_TYPE_LABELS: Record<string, string> = {
  WORKER: 'Workers',
  OFFENSE: 'Offense',
  DEFENSE: 'Defense',
  SPY: 'Spy',
  SENTRY: 'Sentry',
};

const UNIT_TYPE_ORDER = [
  UnitType.WORKER,
  UnitType.OFFENSE,
  UnitType.DEFENSE,
  UnitType.SPY,
  UnitType.SENTRY,
];

export default function TrainingPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'train' | 'untrain'>('train');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery<TrainingStatus>({
    queryKey: ['training', 'status'],
    queryFn: () => api.get('/training/status'),
    enabled: isReady,
  });

  const trainMutation = useMutation({
    mutationFn: (units: Array<{ unitType: string; level: number; quantity: number }>) =>
      api.post('/training/train', { units }),
    onSuccess: () => {
      setError(null);
      setSuccess('Units trained successfully!');
      setQuantities({});
      queryClient.invalidateQueries({ queryKey: ['training'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const untrainMutation = useMutation({
    mutationFn: (units: Array<{ unitType: string; level: number; quantity: number }>) =>
      api.post('/training/untrain', { units }),
    onSuccess: () => {
      setError(null);
      setSuccess('Units untrained successfully! 75% gold refunded.');
      setQuantities({});
      queryClient.invalidateQueries({ queryKey: ['training'] });
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
  const goldInBank = Number(status.goldInBank);
  const { citizens, fortLevel, pricesBonusLevel } = status;

  const getOwnedQuantity = (unitType: string, level: number): number => {
    const entry = status.units.find(
      (u) => u.unitType === unitType && u.level === level,
    );
    return entry?.quantity ?? 0;
  };

  const getKey = (unitType: string, level: number) => `${unitType}_${level}`;

  const getDiscountedCost = (cost: number) =>
    cost - Math.round((pricesBonusLevel / 100) * cost);

  const getUnitsForSubmit = () => {
    const units: Array<{ unitType: string; level: number; quantity: number }> = [];
    for (const [key, qty] of Object.entries(quantities)) {
      if (qty > 0) {
        const [unitType, levelStr] = key.split('_');
        units.push({ unitType, level: parseInt(levelStr, 10), quantity: qty });
      }
    }
    return units;
  };

  const calculateTotalCost = () => {
    let total = 0;
    for (const [key, qty] of Object.entries(quantities)) {
      if (qty > 0) {
        const [unitType, levelStr] = key.split('_');
        const level = parseInt(levelStr, 10);
        const def = status.unitDefinitions.find(
          (d) => d.type === unitType && d.level === level,
        );
        if (def) {
          total += getDiscountedCost(def.cost) * qty;
        }
      }
    }
    return total;
  };

  const calculateTotalRefund = () => {
    let total = 0;
    for (const [key, qty] of Object.entries(quantities)) {
      if (qty > 0) {
        const [unitType, levelStr] = key.split('_');
        const level = parseInt(levelStr, 10);
        const def = status.unitDefinitions.find(
          (d) => d.type === unitType && d.level === level,
        );
        if (def) {
          total += Math.floor(getDiscountedCost(def.cost) * qty * 0.75);
        }
      }
    }
    return total;
  };

  const totalQuantity = Object.values(quantities).reduce((s, q) => s + (q || 0), 0);
  const totalCost = calculateTotalCost();
  const totalRefund = calculateTotalRefund();

  const canTrain = totalQuantity > 0 && totalCost <= gold && totalQuantity <= citizens;
  const canUntrain = totalQuantity > 0;

  const handleSubmit = () => {
    setError(null);
    setSuccess(null);
    const units = getUnitsForSubmit();
    if (units.length === 0) return;

    if (mode === 'train') {
      trainMutation.mutate(units);
    } else {
      untrainMutation.mutate(units);
    }
  };

  const renderUnitSection = (unitType: UnitType) => {
    const defs = status.unitDefinitions.filter((d) => d.type === unitType);
    if (defs.length === 0) return null;

    return (
      <Paper withBorder p="md" key={unitType}>
        <Title order={4} mb="sm">
          {UNIT_TYPE_LABELS[unitType] || unitType}
        </Title>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Unit</Table.Th>
              <Table.Th ta="center">Level</Table.Th>
              <Table.Th ta="right">Cost</Table.Th>
              <Table.Th ta="right">Bonus</Table.Th>
              <Table.Th ta="right">Owned</Table.Th>
              <Table.Th ta="right">Quantity</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {defs.map((def) => {
              const key = getKey(def.type, def.level);
              const owned = getOwnedQuantity(def.type, def.level);
              const locked = def.fortLevel > fortLevel;
              const discountedCost = getDiscountedCost(def.cost);

              return (
                <Table.Tr key={key} style={locked ? { opacity: 0.5 } : undefined}>
                  <Table.Td>
                    {def.name}
                    {locked && (
                      <Badge color="red" size="xs" ml="xs">
                        Fort Lv {def.fortLevel}
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
                      max={
                        mode === 'untrain'
                          ? owned
                          : undefined
                      }
                      value={quantities[key] || 0}
                      onChange={(val) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [key]: typeof val === 'number' ? val : 0,
                        }))
                      }
                      disabled={locked}
                      w={100}
                      styles={{ input: { textAlign: 'right' } }}
                    />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Paper>
    );
  };

  return (
    <Container size="md">
      <Stack gap="md">
        <Title order={2}>Training</Title>

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
        <Paper withBorder p="md">
          <Group justify="space-between">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Untrained Citizens</Text>
              <Text fw={700} size="lg">{toLocale(citizens)}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Gold on Hand</Text>
              <Text fw={700} size="lg">{toLocale(gold)}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Gold in Bank</Text>
              <Text fw={700} size="lg">{toLocale(goldInBank)}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Fort Level</Text>
              <Text fw={700} size="lg">{fortLevel}</Text>
            </Stack>
          </Group>
        </Paper>

        {/* Mode toggle */}
        <Tabs
          value={mode}
          onChange={(val) => {
            setMode(val as 'train' | 'untrain');
            setQuantities({});
            setError(null);
            setSuccess(null);
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="train">Train</Tabs.Tab>
            <Tabs.Tab value="untrain">Untrain</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {/* Unit sections */}
        {UNIT_TYPE_ORDER.map((type) => renderUnitSection(type))}

        {/* Action bar */}
        <Paper withBorder p="md">
          <Group justify="space-between" align="center">
            <Stack gap={4}>
              {mode === 'train' ? (
                <>
                  <Text size="sm">
                    Total Cost: <Text component="span" fw={700}>{toLocale(totalCost)}</Text> gold
                  </Text>
                  <Text size="sm">
                    Citizens needed: <Text component="span" fw={700}>{toLocale(totalQuantity)}</Text>
                  </Text>
                  {totalCost > gold && (
                    <Text size="xs" c="red">Not enough gold</Text>
                  )}
                  {totalQuantity > citizens && (
                    <Text size="xs" c="red">Not enough citizens</Text>
                  )}
                </>
              ) : (
                <>
                  <Text size="sm">
                    Refund (75%): <Text component="span" fw={700} c="green">{toLocale(totalRefund)}</Text> gold
                  </Text>
                  <Text size="sm">
                    Citizens returned: <Text component="span" fw={700}>{toLocale(totalQuantity)}</Text>
                  </Text>
                </>
              )}
            </Stack>
            <Button
              size="md"
              onClick={handleSubmit}
              loading={trainMutation.isPending || untrainMutation.isPending}
              disabled={mode === 'train' ? !canTrain : !canUntrain}
              color={mode === 'train' ? 'blue' : 'orange'}
            >
              {mode === 'train' ? 'Train Units' : 'Untrain Units'}
            </Button>
          </Group>
        </Paper>
      </Stack>
    </Container>
  );
}
