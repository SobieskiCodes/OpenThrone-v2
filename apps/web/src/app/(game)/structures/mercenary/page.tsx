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
  Table,
  ThemeIcon,
} from '@mantine/core';
import { OTCard } from '@/components/ui';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/use-api';
import { toLocale } from '@openthrone/game-logic';
import { BuildingType } from '@openthrone/shared';
import { IconSword, IconShield, IconEye, IconLock, IconClock } from '@tabler/icons-react';

interface StockItem {
  unitType: string;
  unitName: string;
  bonus: number;
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
    dailyMercStock: number;
  } | null;
  stock: StockItem[];
}

export default function MercenaryCampPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { data: mercStatus, isLoading: mercLoading } = useQuery<MercenaryStatus>({
    queryKey: ['structures', 'mercenary'],
    queryFn: () => api.get('/structures/mercenary'),
    enabled: isReady,
  });

  // Redirect to buildings page if mercenary camp not built
  useEffect(() => {
    if (mercStatus && mercStatus.campLevel < 1) {
      router.push('/structures/buildings');
    }
  }, [mercStatus, router]);

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

        {/* Upgrade notice */}
        {mercStatus.nextUpgrade && (
          <Alert color="blue" title="Upgrade Available">
            <Text size="sm">
              Upgrade to <strong>{mercStatus.nextUpgrade.name}</strong> for <strong>{mercStatus.nextUpgrade.dailyMercStock} daily mercenaries</strong> (currently {mercStatus.stock.reduce((s, i) => s + i.total, 0)}).
              Visit the <strong>Buildings</strong> page to upgrade.
            </Text>
          </Alert>
        )}

        {/* Stock table */}
        {mercStatus.campLevel >= 1 && (
          <>
            <OTCard>
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Title order={3}>Available Mercenaries</Title>
                  <Group gap="xs">
                    <ThemeIcon size="sm" variant="light" color="gray">
                      <IconClock size={14} />
                    </ThemeIcon>
                    <Text size="sm" c="var(--ot-text-dim)">Resets at midnight UTC</Text>
                  </Group>
                </Group>

                <Table highlightOnHover striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Unit</Table.Th>
                      <Table.Th>Stats</Table.Th>
                      <Table.Th>Price</Table.Th>
                      <Table.Th>Available</Table.Th>
                      <Table.Th style={{ width: 200 }}>Hire</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {mercStatus.stock.map((item) => {
                      const getStatIcon = () => {
                        switch (item.unitType) {
                          case 'OFFENSE': return <IconSword size={16} />;
                          case 'DEFENSE': return <IconShield size={16} />;
                          case 'SPY': return <IconEye size={16} />;
                          case 'SENTRY': return <IconLock size={16} />;
                          default: return null;
                        }
                      };

                      const getStatColor = () => {
                        switch (item.unitType) {
                          case 'OFFENSE': return 'red';
                          case 'DEFENSE': return 'blue';
                          case 'SPY': return 'grape';
                          case 'SENTRY': return 'cyan';
                          default: return 'gray';
                        }
                      };

                      return (
                        <Table.Tr key={item.unitType} style={{ opacity: item.available > 0 ? 1 : 0.5 }}>
                          <Table.Td>
                            <Stack gap={4}>
                              <Text fw={600} size="sm">{item.unitName}</Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              variant="light"
                              color={getStatColor()}
                              leftSection={getStatIcon()}
                              size="md"
                            >
                              {item.bonus}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={600}>💰 {toLocale(item.cost)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={4}>
                              <Text
                                size="sm"
                                c={item.available > 0 ? 'var(--ot-success)' : 'var(--ot-danger)'}
                                fw={600}
                              >
                                {item.available} / {item.total}
                              </Text>
                              <Progress
                                value={item.total > 0 ? ((item.total - item.available) / item.total) * 100 : 0}
                                size="xs"
                                color={item.available > 0 ? 'green' : 'red'}
                              />
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs" wrap="nowrap">
                              <NumberInput
                                min={1}
                                max={item.available}
                                value={quantities[item.unitType] ?? ''}
                                onChange={(val) =>
                                  setQuantities((prev) => ({
                                    ...prev,
                                    [item.unitType]: typeof val === 'number' ? val : 0,
                                  }))
                                }
                                size="xs"
                                disabled={item.available <= 0}
                                style={{ width: 70 }}
                                hideControls
                              />
                              <Button
                                size="xs"
                                color="var(--ot-accent)"
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
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Stack>
            </OTCard>

            <OTCard>
              <Stack gap="xs">
                <Text fw={600} size="sm">Mercenary System</Text>
                <Text size="sm" c="var(--ot-text-dim)">
                  • <strong>Pre-Trained Units:</strong> No citizens required - just gold!
                </Text>
                <Text size="sm" c="var(--ot-text-dim)">
                  • <strong>Daily Stock:</strong> Random allocation refreshes at midnight UTC
                </Text>
                <Text size="sm" c="var(--ot-text-dim)">
                  • <strong>Camp Upgrades:</strong> Higher levels = more daily mercenaries
                </Text>
                <Text size="xs" c="var(--ot-text-dim)" pl="md">
                  - Level 1: 20/day | Level 2: 30/day | Level 3+: 40/day
                </Text>
                <Text size="sm" c="var(--ot-text-dim)">
                  • <strong>Fair Distribution:</strong> 30% offense, 30% defense, 20% spy, 20% sentry
                </Text>
              </Stack>
            </OTCard>
          </>
        )}
      </Stack>
    </Container>
  );
}
