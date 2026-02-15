'use client';

import {
  Container,
  Title,
  Paper,
  Group,
  Stack,
  Text,
  Button,
  Badge,
  Skeleton,
  Alert,
  SimpleGrid,
  NumberInput,
  Progress,
} from '@mantine/core';
import { OTCard } from '@/components/ui';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { toLocale } from '@openthrone/game-logic';
import { BuildingType } from '@openthrone/shared';

interface StockItem {
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
  nextUpgrade: {
    name: string;
    cost: number;
    fortLevel: number;
    dailyStock: number;
  } | null;
  stock: StockItem[];
}

export default function MercenaryCampPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { data: mercStatus, isLoading: mercLoading } = useQuery<MercenaryStatus>({
    queryKey: ['structures', 'mercenary'],
    queryFn: () => api.get('/structures/mercenary'),
    enabled: isReady,
  });

  const { data: structStatus } = useQuery<{ gold: string; fort: { level: number } }>({
    queryKey: ['structures', 'status'],
    queryFn: () => api.get('/structures/status'),
    enabled: isReady,
  });

  const upgradeMutation = useMutation({
    mutationFn: () =>
      api.post('/structures/buildings/upgrade', { buildingType: BuildingType.MERCENARY_CAMP }),
    onSuccess: (data: any) => {
      setError(null);
      setSuccess(`Camp upgraded to level ${data.newLevel}!`);
      queryClient.invalidateQueries({ queryKey: ['structures'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const buyMutation = useMutation({
    mutationFn: (units: Array<{ unitType: string; quantity: number }>) =>
      api.post('/structures/mercenary/buy', { units }),
    onSuccess: () => {
      setError(null);
      setSuccess('Mercenaries hired successfully!');
      setQuantities({});
      queryClient.invalidateQueries({ queryKey: ['structures'] });
      queryClient.invalidateQueries({ queryKey: ['player'] });
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  if (mercLoading || !mercStatus) {
    return (
      <Container size="md">
        <Stack gap="md">
          <Skeleton height={40} width={250} />
          <Skeleton height={100} />
          <Skeleton height={300} />
        </Stack>
      </Container>
    );
  }

  const gold = Number(structStatus?.gold ?? '0');
  const fortLevel = structStatus?.fort?.level ?? 1;

  const handleHire = (unitType: string) => {
    const qty = quantities[unitType];
    if (!qty || qty <= 0) return;
    setError(null);
    setSuccess(null);
    buyMutation.mutate([{ unitType, quantity: qty }]);
  };

  return (
    <Container size="md">
      <Stack gap="md">
        <Group gap="sm" align="center">
          <Title order={2}>Mercenary Camp</Title>
          <Badge size="lg" variant="light" color="yellow">
            {mercStatus.campName}
          </Badge>
        </Group>

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

        {/* Status bar */}
        <OTCard>
          <Group justify="space-between" wrap="wrap" gap="md">
            <Stack gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Gold on Hand</Text>
              <Text fw={700} size="lg" className="ot-stat-value">{toLocale(gold)}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Camp Level</Text>
              <Text fw={700} size="lg">{mercStatus.campLevel}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Daily Stock</Text>
              <Text fw={700} size="lg">
                {mercStatus.stock.reduce((sum, s) => sum + s.total, 0)} mercs
              </Text>
            </Stack>
          </Group>
        </OTCard>

        {/* Upgrade card */}
        {mercStatus.nextUpgrade && (
          <Paper withBorder p="md">
            <Title order={4} mb="sm">Next Upgrade</Title>
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm">Name:</Text>
                <Text size="sm" fw={700}>{mercStatus.nextUpgrade.name}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Daily Stock:</Text>
                <Text size="sm" fw={700} c="green">
                  {mercStatus.stock.reduce((s, i) => s + i.total, 0)} → {mercStatus.nextUpgrade.dailyStock}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Cost:</Text>
                <Text size="sm" fw={700}>{toLocale(mercStatus.nextUpgrade.cost)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Requires:</Text>
                <Badge
                  color={fortLevel >= mercStatus.nextUpgrade.fortLevel ? 'green' : 'red'}
                  size="sm"
                  variant="light"
                >
                  Fort Level {mercStatus.nextUpgrade.fortLevel}
                </Badge>
              </Group>
              <Button
                color="blue"
                disabled={
                  fortLevel < mercStatus.nextUpgrade.fortLevel ||
                  gold < mercStatus.nextUpgrade.cost
                }
                loading={upgradeMutation.isPending}
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  upgradeMutation.mutate();
                }}
              >
                Upgrade Camp ({toLocale(mercStatus.nextUpgrade.cost)} gold)
              </Button>
            </Stack>
          </Paper>
        )}

        {/* Stock grid */}
        {mercStatus.campLevel > 1 && (
          <>
            <Title order={3}>Available Mercenaries</Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {mercStatus.stock.map((item) => (
                <OTCard key={item.unitType}>
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text fw={700} size="lg">{item.unitName}</Text>
                      <Badge
                        variant="light"
                        color={item.unitType === 'OFFENSE' || item.unitType === 'DEFENSE' ? 'blue' : 'grape'}
                        size="sm"
                      >
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
                        value={quantities[item.unitType] ?? ''}
                        onChange={(val) =>
                          setQuantities((prev) => ({
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
                          !quantities[item.unitType] ||
                          (quantities[item.unitType] ?? 0) <= 0 ||
                          gold < item.cost * (quantities[item.unitType] ?? 0)
                        }
                        loading={buyMutation.isPending}
                        onClick={() => handleHire(item.unitType)}
                      >
                        Hire
                      </Button>
                    </Group>

                    {(quantities[item.unitType] ?? 0) > 0 && (
                      <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                        Total: {toLocale(item.cost * (quantities[item.unitType] ?? 0))} gold
                      </Text>
                    )}
                  </Stack>
                </OTCard>
              ))}
            </SimpleGrid>

            <Text size="sm" ta="center" style={{ color: 'var(--ot-text-dim)' }}>
              Stock resets daily at midnight
            </Text>
          </>
        )}

        {mercStatus.campLevel <= 1 && (
          <Paper withBorder p="lg" ta="center">
            <Text size="lg" style={{ color: 'var(--ot-text-dim)' }}>
              Build a Mercenary Camp to hire pre-trained soldiers for gold — no citizens required!
            </Text>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
