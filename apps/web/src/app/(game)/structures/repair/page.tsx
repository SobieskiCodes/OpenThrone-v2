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
  Skeleton,
  Alert,
  Progress,
} from '@mantine/core';
import { OTCard } from '@/components/ui';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { toLocale } from '@openthrone/game-logic';

interface StructuresStatus {
  gold: string;
  goldInBank: string;
  fort: {
    level: number;
    name: string;
    hitpoints: number;
    maxHitpoints: number;
    costPerRepairPoint: number;
    goldPerTurn: number;
    defenseBonusPercentage: number;
  };
}

export default function FortificationRepairPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [repairPoints, setRepairPoints] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery<StructuresStatus>({
    queryKey: ['structures', 'status'],
    queryFn: () => api.get('/structures/status'),
    enabled: isReady,
  });

  const repairMutation = useMutation({
    mutationFn: (points: number) =>
      api.post('/structures/repair', { points }),
    onSuccess: (data: any) => {
      setError(null);
      setSuccess(`Repaired ${toLocale(data.repaired)} HP! Fort is now at ${toLocale(data.newHitpoints)}/${toLocale(data.maxHitpoints)}.`);
      setRepairPoints(0);
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
          <Skeleton height={200} />
        </Stack>
      </Container>
    );
  }

  const gold = Number(status.gold);
  const { fort } = status;
  const damageAmount = fort.maxHitpoints - fort.hitpoints;
  const isFullHealth = damageAmount === 0;
  const healthPercent = (fort.hitpoints / fort.maxHitpoints) * 100;

  const actualRepair = Math.min(repairPoints, damageAmount);
  const repairCost = actualRepair * fort.costPerRepairPoint;
  const canAfford = gold >= repairCost;

  const handleRepairAll = () => {
    const maxAffordable = Math.floor(gold / fort.costPerRepairPoint);
    setRepairPoints(Math.min(maxAffordable, damageAmount));
  };

  return (
    <Container size="md">
      <Stack gap="md">
        <Title order={2}>Fortification Repair</Title>

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
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Fortification</Text>
              <Text fw={700} size="lg">{fort.name} (Lv {fort.level})</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Defense Bonus</Text>
              <Text fw={700} size="lg">+{fort.defenseBonusPercentage}%</Text>
            </Stack>
          </Group>
        </OTCard>

        <Paper withBorder p="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Text size="sm" fw={500}>Fortification Health</Text>
              <Text size="sm" c={isFullHealth ? 'green' : 'orange'}>
                {toLocale(fort.hitpoints)} / {toLocale(fort.maxHitpoints)} HP
              </Text>
            </Group>
            <Progress
              value={healthPercent}
              color={isFullHealth ? 'green' : healthPercent > 50 ? 'yellow' : 'red'}
              size="xl"
            />

            {isFullHealth ? (
              <Alert color="green">
                Your fortification is at full health! No repairs needed.
              </Alert>
            ) : (
              <Stack gap="sm">
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  Damage: {toLocale(damageAmount)} HP | Cost per repair point: {toLocale(fort.costPerRepairPoint)} gold
                </Text>

                <Group>
                  <NumberInput
                    label="Repair Points"
                    min={0}
                    max={damageAmount}
                    value={repairPoints}
                    onChange={(val) => setRepairPoints(typeof val === 'number' ? val : 0)}
                    w={200}
                  />
                  <Button
                    variant="subtle"
                    size="xs"
                    mt={24}
                    onClick={handleRepairAll}
                  >
                    Max
                  </Button>
                </Group>

                {repairPoints > 0 && (
                  <Paper withBorder p="sm" bg="var(--mantine-color-gray-light)">
                    <Group justify="space-between">
                      <Text size="sm">Repair Cost:</Text>
                      <Text size="sm" fw={700} c={canAfford ? 'green' : 'red'}>
                        {toLocale(repairCost)} gold
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="sm">HP After Repair:</Text>
                      <Text size="sm" fw={700}>
                        {toLocale(fort.hitpoints + actualRepair)} / {toLocale(fort.maxHitpoints)}
                      </Text>
                    </Group>
                  </Paper>
                )}

                <Button
                  color="blue"
                  disabled={repairPoints <= 0 || !canAfford}
                  loading={repairMutation.isPending}
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    repairMutation.mutate(repairPoints);
                  }}
                >
                  Repair Fortification
                </Button>
              </Stack>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
