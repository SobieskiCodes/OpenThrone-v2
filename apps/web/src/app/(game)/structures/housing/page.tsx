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
  Badge,
} from '@mantine/core';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { toLocale } from '@openthrone/game-logic';
import { StructureUpgradeType } from '@openthrone/shared';

interface HouseDef {
  name: string;
  fortLevel: number;
  citizensDaily: number;
  cost: number;
  level: number;
}

interface StructuresStatus {
  gold: string;
  goldInBank: string;
  fort: {
    level: number;
    name: string;
  };
  upgrades: {
    house: number;
  };
  definitions: {
    house: HouseDef[];
  };
}

export default function HousingPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery<StructuresStatus>({
    queryKey: ['structures', 'status'],
    queryFn: () => api.get('/structures/status'),
    enabled: isReady,
  });

  const upgradeMutation = useMutation({
    mutationFn: () =>
      api.post('/structures/upgrade', { upgradeType: StructureUpgradeType.HOUSE }),
    onSuccess: (data: any) => {
      setError(null);
      setSuccess(`Housing upgraded to level ${data.newLevel}!`);
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
  const currentLevel = status.upgrades.house;
  const fortLevel = status.fort.level;
  const currentDef = status.definitions.house.find((h) => h.level === currentLevel);
  const nextDef = status.definitions.house.find((h) => h.level === currentLevel + 1);

  return (
    <Container size="md">
      <Stack gap="md">
        <Title order={2}>Housing</Title>

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
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Current Housing</Text>
              <Text fw={700} size="lg">{currentDef?.name ?? `Level ${currentLevel}`}</Text>
            </Stack>
            <Stack gap={4}>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Citizens per Day</Text>
              <Text fw={700} size="lg">{currentDef?.citizensDaily ?? 1}</Text>
            </Stack>
          </Group>
        </Paper>

        {nextDef && (
          <Paper withBorder p="md">
            <Title order={4} mb="sm">Next Upgrade</Title>
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm">Name:</Text>
                <Text size="sm" fw={700}>{nextDef.name}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Citizens per Day:</Text>
                <Text size="sm" fw={700} c="green">
                  {currentDef?.citizensDaily ?? 1} → {nextDef.citizensDaily}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Cost:</Text>
                <Text size="sm" fw={700}>{toLocale(nextDef.cost)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Requires:</Text>
                <Badge
                  color={fortLevel >= nextDef.fortLevel ? 'green' : 'red'}
                  size="sm"
                  variant="light"
                >
                  Fort Level {nextDef.fortLevel}
                </Badge>
              </Group>
              <Button
                color="blue"
                disabled={
                  fortLevel < nextDef.fortLevel || gold < nextDef.cost
                }
                loading={upgradeMutation.isPending}
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  upgradeMutation.mutate();
                }}
              >
                Upgrade Housing ({toLocale(nextDef.cost)} gold)
              </Button>
            </Stack>
          </Paper>
        )}

        <Paper withBorder p="md">
          <Title order={4} mb="sm">All Housing Levels</Title>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Lv</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th ta="right">Cost</Table.Th>
                <Table.Th ta="center">Citizens/Day</Table.Th>
                <Table.Th ta="center">Requires</Table.Th>
                <Table.Th ta="center">Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {status.definitions.house.map((def) => {
                const isCurrentLevel = def.level === currentLevel;
                const isPast = def.level <= currentLevel;
                const fortMet = fortLevel >= def.fortLevel;

                return (
                  <Table.Tr
                    key={def.level}
                    style={
                      isCurrentLevel
                        ? { backgroundColor: 'var(--mantine-color-blue-light)' }
                        : !isPast && !fortMet
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
                    <Table.Td ta="center">{def.citizensDaily}</Table.Td>
                    <Table.Td ta="center">
                      {def.fortLevel > 0 ? (
                        <Badge
                          color={fortMet ? 'green' : 'red'}
                          size="xs"
                          variant="light"
                        >
                          Fort Lv {def.fortLevel}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </Table.Td>
                    <Table.Td ta="center">
                      {isPast && !isCurrentLevel && (
                        <Badge color="gray" size="xs">Done</Badge>
                      )}
                      {isCurrentLevel && (
                        <Badge color="blue" size="xs">Active</Badge>
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
