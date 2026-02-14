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
  buildings: Record<string, number>;
  units: UnitEntry[];
  unitDefinitions: UnitDefinition[];
}

const TAB_LABELS: Record<string, string> = {
  WORKER: 'Workers',
  OFFENSE: 'Offense',
  DEFENSE: 'Defense',
  SPY: 'Spy',
  SENTRY: 'Sentry',
};

const STAT_LABELS: Record<string, string> = {
  WORKER: 'gold/turn',
  OFFENSE: 'OFF',
  DEFENSE: 'DEF',
  SPY: 'SPY',
  SENTRY: 'SENTRY',
};

const TAB_ORDER = [
  UnitType.WORKER,
  UnitType.OFFENSE,
  UnitType.DEFENSE,
  UnitType.SPY,
  UnitType.SENTRY,
];

export default function TrainingPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<string>(UnitType.WORKER);
  const [trainQty, setTrainQty] = useState<Record<string, number>>({});
  const [untrainQty, setUntrainQty] = useState<Record<string, number>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery<TrainingStatus>({
    queryKey: ['training', 'status'],
    queryFn: () => api.get('/training/status'),
    enabled: isReady,
  });

  const trainMutation = useMutation({
    mutationFn: (units: Array<{ unitType: string; level: number; quantity: number }>) =>
      api.post('/training/train', { units }),
    onSuccess: () => {
      setTrainQty({});
      setBusyKey(null);
      queryClient.invalidateQueries({ queryKey: ['training'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
      notifications.show({ title: 'Trained', message: 'Units trained successfully!', color: 'green' });
    },
    onError: (err: Error) => {
      setBusyKey(null);
      notifications.show({ title: 'Training Failed', message: err.message, color: 'red' });
    },
  });

  const untrainMutation = useMutation({
    mutationFn: (units: Array<{ unitType: string; level: number; quantity: number }>) =>
      api.post('/training/untrain', { units }),
    onSuccess: () => {
      setUntrainQty({});
      setBusyKey(null);
      queryClient.invalidateQueries({ queryKey: ['training'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
      notifications.show({ title: 'Untrained', message: 'Units untrained! 75% gold refunded.', color: 'green' });
    },
    onError: (err: Error) => {
      setBusyKey(null);
      notifications.show({ title: 'Untrain Failed', message: err.message, color: 'red' });
    },
  });

  if (isLoading || !status) {
    return (
      <Container size="lg">
        <Stack gap="md">
          <Skeleton height={40} width={200} />
          <Skeleton height={80} />
          <Skeleton height={300} />
        </Stack>
      </Container>
    );
  }

  const gold = Number(status.gold);
  const { citizens, fortLevel } = status;

  const getKey = (unitType: string, level: number) => `${unitType}_${level}`;

  const getOwned = (unitType: string, level: number): number => {
    const entry = status.units.find((u) => u.unitType === unitType && u.level === level);
    return entry?.quantity ?? 0;
  };

  const getTotalOwned = (unitType: string): number =>
    status.units
      .filter((u) => u.unitType === unitType)
      .reduce((sum, u) => sum + u.quantity, 0);

  const getLowerTierDef = (def: UnitDefinition): UnitDefinition | undefined => {
    if (def.level <= 1) return undefined;
    return status.unitDefinitions.find(
      (d) => d.type === def.type && d.level === def.level - 1,
    );
  };

  const getMaxTrainable = (def: UnitDefinition) => {
    const unitCost = def.cost;
    const maxByGold = unitCost <= 0 ? Infinity : Math.floor(gold / unitCost);
    if (def.level === 1) return Math.max(0, Math.min(maxByGold, citizens));
    const lowerOwned = getOwned(def.type, def.level - 1);
    return Math.max(0, Math.min(maxByGold, lowerOwned));
  };

  const handleTrain = (def: UnitDefinition, qty: number) => {
    if (qty <= 0) return;
    setBusyKey(getKey(def.type, def.level) + '_train');
    trainMutation.mutate([{ unitType: def.type, level: def.level, quantity: qty }]);
  };

  const handleUntrain = (def: UnitDefinition, qty: number) => {
    if (qty <= 0) return;
    setBusyKey(getKey(def.type, def.level) + '_untrain');
    untrainMutation.mutate([{ unitType: def.type, level: def.level, quantity: qty }]);
  };

  const defs = status.unitDefinitions.filter((d) => d.type === selectedType);

  return (
    <Container size="lg">
      <Stack gap="md">
        <Title order={2}>Training</Title>

        {/* ── Resource summary ── */}
        <OTCard>
          <Group justify="space-between" wrap="wrap" gap="md">
            <Stack gap={4}>
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Citizens</Text>
              <Group gap="xs" align="baseline">
                <Text fw={700} size="lg" className="ot-stat-value">{toLocale(citizens)}</Text>
                {citizens === 0 && (
                  <Badge color="red" size="xs" variant="light">None</Badge>
                )}
                {citizens > 0 && citizens <= 10 && (
                  <Badge color="yellow" size="xs" variant="light">Low</Badge>
                )}
              </Group>
            </Stack>
            <Stack gap={4}>
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Gold on Hand</Text>
              <Text fw={700} size="lg" className="ot-stat-value">{toLocale(gold)}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Fort Level</Text>
              <Text fw={700} size="lg" className="ot-stat-value">{fortLevel}</Text>
            </Stack>
          </Group>
        </OTCard>

        {/* ── Unit type tabs ── */}
        <Tabs
          value={selectedType}
          onChange={(val) => {
            setSelectedType(val || UnitType.WORKER);
            setTrainQty({});
            setUntrainQty({});
          }}
        >
          <Tabs.List>
            {TAB_ORDER.map((type) => {
              const total = getTotalOwned(type);
              return (
                <Tabs.Tab key={type} value={type}>
                  {TAB_LABELS[type] || type}
                  {total > 0 && (
                    <Badge size="xs" variant="light" ml={6}>{toLocale(total)}</Badge>
                  )}
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </Tabs>

        {/* ── Train table ── */}
        <Paper withBorder p="md">
          <Title order={4} mb="sm">{TAB_LABELS[selectedType]} — Train</Title>

          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Unit</Table.Th>
                <Table.Th ta="center">Stats</Table.Th>
                <Table.Th ta="right">Cost</Table.Th>
                <Table.Th ta="center">Owned</Table.Th>
                <Table.Th ta="right">Qty</Table.Th>
                <Table.Th ta="center">Action</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {defs.map((def) => {
                const key = getKey(def.type, def.level);
                const owned = getOwned(def.type, def.level);
                const locked = (def.buildingRequirements ?? []).some((req: { buildingType: string; level: number }) => {
                  const playerLevel = status.buildings?.[req.buildingType] ?? 0;
                  return playerLevel < req.level;
                });
                const isLv2Plus = def.level > 1;
                const lowerDef = getLowerTierDef(def);
                const sourceAvailable = isLv2Plus ? getOwned(def.type, def.level - 1) : citizens;
                const qty = trainQty[key] || 0;
                const isTraining = busyKey === key + '_train';

                const costLabel = isLv2Plus
                  ? `${toLocale(def.cost)} + 1 ${lowerDef?.name ?? 'unit'}`
                  : `${toLocale(def.cost)} + 1 citizen`;

                const statLabel = `+${def.bonus} ${STAT_LABELS[def.type] || ''}`;

                return (
                  <Table.Tr key={key} style={locked ? { opacity: 0.5 } : undefined}>
                    <Table.Td>
                      {def.name}
                      {locked && (def.buildingRequirements ?? [])
                        .filter((req: { buildingType: string; level: number }) => (status.buildings?.[req.buildingType] ?? 0) < req.level)
                        .map((req: { buildingType: string; level: number }, i: number) => {
                          const buildingName = req.buildingType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                          return (
                            <Badge key={i} color="red" size="xs" ml="xs" variant="light">
                              {buildingName} Lv{req.level}
                            </Badge>
                          );
                        })
                      }
                      {isLv2Plus && !locked && (
                        <Badge color="blue" size="xs" variant="light" ml="xs">
                          {toLocale(sourceAvailable)} {lowerDef?.name ?? 'units'}
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td ta="center">{statLabel}</Table.Td>
                    <Table.Td ta="right">
                      {toLocale(def.cost)}
                    </Table.Td>
                    <Table.Td ta="center">{toLocale(owned)}</Table.Td>
                    <Table.Td ta="right">
                      <NumberInput
                        size="xs"
                        min={0}
                        value={qty || ''}
                        placeholder="0"
                        onChange={(val) =>
                          setTrainQty((prev) => ({
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
                          disabled={locked}
                          onClick={() => {
                            const max = getMaxTrainable(def);
                            if (max > 0) setTrainQty((prev) => ({ ...prev, [key]: max }));
                          }}
                        >
                          Max
                        </Button>
                        <Button
                          size="xs"
                          disabled={locked || qty <= 0 || qty * def.cost > gold || qty > sourceAvailable}
                          loading={isTraining}
                          onClick={() => handleTrain(def, qty)}
                        >
                          {isLv2Plus ? 'Upgrade' : 'Train'}
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>

          {/* Cost info: requirement for Lv2+ */}
          {defs.some((d) => d.level > 1 && !(d.buildingRequirements ?? []).some((req: any) => (status.buildings?.[req.buildingType] ?? 0) < req.level)) && (
            <Text size="xs" mt="sm" style={{ color: 'var(--ot-text-dim)' }}>
              Upgrading a unit consumes 1 lower-tier unit of the same type.
            </Text>
          )}
        </Paper>

        {/* ── Untrain table ── */}
        {defs.some((d) => !(d.buildingRequirements ?? []).some((req: any) => (status.buildings?.[req.buildingType] ?? 0) < req.level) && getOwned(d.type, d.level) > 0) && (
          <Paper withBorder p="md">
            <Title order={4} mb="sm">{TAB_LABELS[selectedType]} — Untrain (75% gold refund)</Title>

            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Unit</Table.Th>
                  <Table.Th ta="center">Owned</Table.Th>
                  <Table.Th ta="right">Refund Each</Table.Th>
                  <Table.Th ta="right">Qty</Table.Th>
                  <Table.Th ta="center">Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {defs
                  .filter((d) => !(d.buildingRequirements ?? []).some((req: any) => (status.buildings?.[req.buildingType] ?? 0) < req.level) && getOwned(d.type, d.level) > 0)
                  .map((def) => {
                    const key = getKey(def.type, def.level);
                    const owned = getOwned(def.type, def.level);
                    const refundEach = Math.floor(def.cost * 0.75);
                    const qty = untrainQty[key] || 0;
                    const isUntraining = busyKey === key + '_untrain';

                    return (
                      <Table.Tr key={key}>
                        <Table.Td>{def.name}</Table.Td>
                        <Table.Td ta="center">{toLocale(owned)}</Table.Td>
                        <Table.Td ta="right" c="green">{toLocale(refundEach)}</Table.Td>
                        <Table.Td ta="right">
                          <NumberInput
                            size="xs"
                            min={0}
                            max={owned}
                            value={qty || ''}
                            placeholder="0"
                            onChange={(val) =>
                              setUntrainQty((prev) => ({
                                ...prev,
                                [key]: typeof val === 'number' ? val : 0,
                              }))
                            }
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
                              onClick={() => setUntrainQty((prev) => ({ ...prev, [key]: owned }))}
                            >
                              All
                            </Button>
                            <Button
                              size="xs"
                              color="orange"
                              variant="light"
                              disabled={qty <= 0}
                              loading={isUntraining}
                              onClick={() => handleUntrain(def, qty)}
                            >
                              Untrain
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
