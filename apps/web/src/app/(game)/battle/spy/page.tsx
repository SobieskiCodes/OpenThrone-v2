'use client';

import { useState, useEffect, Suspense } from 'react';
import {
  Container,
  Title,
  Stack,
  Tabs,
  Paper,
  TextInput,
  Select,
  Group,
  Badge,
  Text,
  Button,
  NumberInput,
  SimpleGrid,
  Loader,
  Center,
  Table,
  Skeleton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useApi } from '@/hooks/use-api';

interface PlayerEntry {
  id: string;
  displayName: string;
  race: string;
  class: string;
  level: number;
  offense: number;
  defense: number;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface SpyResult {
  success: boolean;
  missionType: string;
  spiesLost: number;
  spiesSurvived: number;
  revealPercent?: number;
  intelData?: Record<string, any>;
  unitsKilled?: number;
  targetUnitType?: string;
  fortDamage?: number;
}

const TARGET_UNIT_OPTIONS = [
  { value: 'OFFENSE', label: 'Offense Units' },
  { value: 'DEFENSE', label: 'Defense Units' },
  { value: 'SPY', label: 'Spy Units' },
  { value: 'SENTRY', label: 'Sentry Units' },
  { value: 'CITIZEN', label: 'Citizens' },
];

function SpyPageContent() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const targetParam = searchParams.get('target');
  const [missionTab, setMissionTab] = useState('intel');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<PlayerEntry | null>(null);
  const [spiesSent, setSpiesSent] = useState(5);
  const [targetUnitType, setTargetUnitType] = useState('OFFENSE');
  const [result, setResult] = useState<SpyResult | null>(null);
  const [targetLoaded, setTargetLoaded] = useState(false);

  // Auto-load target from query param
  const { data: targetPlayer } = useQuery<any>({
    queryKey: ['player', targetParam],
    queryFn: () => api.get(`/player/${targetParam}`),
    enabled: isReady && !!targetParam && !targetLoaded,
  });

  useEffect(() => {
    if (targetPlayer && !targetLoaded) {
      setSelectedTarget({
        id: targetPlayer.id,
        displayName: targetPlayer.displayName,
        race: targetPlayer.race,
        class: targetPlayer.class,
        level: targetPlayer.stats?.level ?? 1,
        offense: targetPlayer.stats?.offense ?? 0,
        defense: targetPlayer.stats?.defense ?? 0,
      });
      setTargetLoaded(true);
    }
  }, [targetPlayer, targetLoaded]);

  const { data: searchResults, isLoading: searchLoading } = useQuery<PaginatedResponse<PlayerEntry>>({
    queryKey: ['battle', 'players', 'spy-search', searchQuery],
    queryFn: () => api.get(`/battle/players?search=${encodeURIComponent(searchQuery)}&limit=10`),
    enabled: isReady && searchQuery.length >= 2,
  });

  const spyMutation = useMutation({
    mutationFn: (body: { type: string; spiesSent: number; targetUnitType?: string }) =>
      api.post(`/battle/spy/${selectedTarget!.id}`, body) as Promise<SpyResult>,
    onSuccess: (data: SpyResult) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['battle'] });
      notifications.show({
        title: data.success ? 'Mission Successful' : 'Mission Failed',
        message: data.success
          ? 'Your spies completed the mission.'
          : 'Your spies were detected and the mission failed.',
        color: data.success ? 'green' : 'red',
      });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Spy Mission Error', message: err.message, color: 'red' });
    },
  });

  const handleExecuteMission = () => {
    if (!selectedTarget) return;
    const missionType = missionTab === 'intel' ? 'INTEL'
      : missionTab === 'assassinate' ? 'ASSASSINATE'
      : 'INFILTRATE';

    const body: any = {
      type: missionType,
      spiesSent,
    };

    if (missionTab === 'assassinate') {
      body.targetUnitType = targetUnitType;
    }

    setResult(null);
    spyMutation.mutate(body);
  };

  return (
    <Container size="lg">
      <Stack gap="md">
        <Title order={2} style={{ color: 'var(--ot-gold)' }}>
          Spy Missions
        </Title>

        {/* Target Selection */}
        <Paper withBorder p="md" className="ot-card">
          <Stack gap="sm">
            <Text fw={600} style={{ color: 'var(--ot-gold)' }}>Select Target</Text>
            <TextInput
              placeholder="Search player by name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.currentTarget.value);
                setSelectedTarget(null);
                setResult(null);
              }}
            />

            {searchLoading && searchQuery.length >= 2 && (
              <Center><Loader size="sm" /></Center>
            )}

            {searchResults && searchResults.data.length > 0 && !selectedTarget && (
              <div className="ot-table-scroll">
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Player</Table.Th>
                      <Table.Th>Race</Table.Th>
                      <Table.Th>Level</Table.Th>
                      <Table.Th ta="right">Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {searchResults.data.map((p) => (
                      <Table.Tr key={p.id}>
                        <Table.Td>
                          <Text fw={500} style={{ color: 'var(--ot-gold)' }}>{p.displayName}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="sm">{p.race}</Badge>
                        </Table.Td>
                        <Table.Td>{p.level}</Table.Td>
                        <Table.Td ta="right">
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => setSelectedTarget(p)}
                          >
                            Select
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}

            {selectedTarget && (
              <Paper p="sm" withBorder style={{ borderColor: 'var(--ot-gold-dim)' }}>
                <Group justify="space-between">
                  <Group gap="sm">
                    <Text fw={600} style={{ color: 'var(--ot-gold)' }}>{selectedTarget.displayName}</Text>
                    <Badge variant="light" size="sm">{selectedTarget.race}</Badge>
                    <Badge variant="light" color="gray" size="sm">Lv {selectedTarget.level}</Badge>
                  </Group>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={() => { setSelectedTarget(null); setResult(null); }}
                  >
                    Change
                  </Button>
                </Group>
              </Paper>
            )}
          </Stack>
        </Paper>

        {/* Mission Tabs */}
        {selectedTarget && (
          <Tabs value={missionTab} onChange={(v) => { setMissionTab(v ?? 'intel'); setResult(null); }}>
            <Tabs.List>
              <Tabs.Tab value="intel">Intel</Tabs.Tab>
              <Tabs.Tab value="assassinate">Assassination</Tabs.Tab>
              <Tabs.Tab value="infiltrate">Infiltration</Tabs.Tab>
            </Tabs.List>

            {/* Intel Tab */}
            <Tabs.Panel value="intel" pt="md">
              <Paper withBorder p="md" className="ot-card">
                <Stack gap="sm">
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    Send spies to gather intelligence on the target. Each spy reveals 10% of their information.
                    Requires Spy units (level 1+).
                  </Text>
                  <NumberInput
                    label="Spies to Send"
                    value={spiesSent}
                    onChange={(v) => setSpiesSent(Number(v) || 1)}
                    min={1}
                    max={10}
                    w={200}
                  />
                  <Button
                    onClick={handleExecuteMission}
                    loading={spyMutation.isPending}
                    disabled={!selectedTarget}
                    style={{ backgroundColor: 'var(--ot-gold)', color: '#000' }}
                    w={200}
                  >
                    Send Spies
                  </Button>
                </Stack>
              </Paper>
            </Tabs.Panel>

            {/* Assassination Tab */}
            <Tabs.Panel value="assassinate" pt="md">
              <Paper withBorder p="md" className="ot-card">
                <Stack gap="sm">
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    Send assassins to eliminate specific enemy units. Requires Assassin units (spy level 3).
                    Higher risk but can take out key units.
                  </Text>
                  <Group>
                    <NumberInput
                      label="Assassins to Send"
                      value={spiesSent}
                      onChange={(v) => setSpiesSent(Number(v) || 1)}
                      min={1}
                      max={10}
                      w={200}
                    />
                    <Select
                      label="Target Unit Type"
                      data={TARGET_UNIT_OPTIONS}
                      value={targetUnitType}
                      onChange={(v) => setTargetUnitType(v ?? 'OFFENSE')}
                      w={200}
                    />
                  </Group>
                  <Button
                    onClick={handleExecuteMission}
                    loading={spyMutation.isPending}
                    disabled={!selectedTarget}
                    color="red"
                    w={200}
                  >
                    Send Assassins
                  </Button>
                </Stack>
              </Paper>
            </Tabs.Panel>

            {/* Infiltration Tab */}
            <Tabs.Panel value="infiltrate" pt="md">
              <Paper withBorder p="md" className="ot-card">
                <Stack gap="sm">
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    Send infiltrators to sabotage the enemy&apos;s fortifications. Requires Infiltrator units (spy level 2).
                    Deals direct damage to their fort hitpoints.
                  </Text>
                  <NumberInput
                    label="Infiltrators to Send"
                    value={spiesSent}
                    onChange={(v) => setSpiesSent(Number(v) || 1)}
                    min={1}
                    max={10}
                    w={200}
                  />
                  <Button
                    onClick={handleExecuteMission}
                    loading={spyMutation.isPending}
                    disabled={!selectedTarget}
                    color="orange"
                    w={200}
                  >
                    Send Infiltrators
                  </Button>
                </Stack>
              </Paper>
            </Tabs.Panel>
          </Tabs>
        )}

        {/* Results */}
        {result && (
          <Paper withBorder p="md" className="ot-card">
            <Stack gap="sm">
              <Group>
                <Text fw={600} style={{ color: result.success ? '#4ecdc4' : '#ff6b6b' }}>
                  {result.success ? 'Mission Successful' : 'Mission Failed'}
                </Text>
                <Badge color={result.success ? 'green' : 'red'} variant="light">
                  {result.missionType.toUpperCase()}
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
                <Paper p="xs" withBorder>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Spies Lost</Text>
                  <Text fw={600} style={{ color: '#ff6b6b' }}>{result.spiesLost}</Text>
                </Paper>
                <Paper p="xs" withBorder>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Spies Survived</Text>
                  <Text fw={600} style={{ color: '#4ecdc4' }}>{result.spiesSurvived}</Text>
                </Paper>

                {result.revealPercent !== undefined && (
                  <Paper p="xs" withBorder>
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Intel Revealed</Text>
                    <Text fw={600} style={{ color: 'var(--ot-gold)' }}>{result.revealPercent}%</Text>
                  </Paper>
                )}

                {result.unitsKilled !== undefined && result.unitsKilled > 0 && (
                  <Paper p="xs" withBorder>
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Units Killed</Text>
                    <Text fw={600} style={{ color: '#c44dff' }}>
                      {result.unitsKilled} {result.targetUnitType}
                    </Text>
                  </Paper>
                )}

                {result.fortDamage !== undefined && result.fortDamage > 0 && (
                  <Paper p="xs" withBorder>
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Fort Damage</Text>
                    <Text fw={600} style={{ color: '#ffa07a' }}>{result.fortDamage}</Text>
                  </Paper>
                )}
              </SimpleGrid>

              {/* Intel Data */}
              {result.intelData && Object.keys(result.intelData).length > 0 && (
                <>
                  <Text fw={600} style={{ color: 'var(--ot-gold)' }} mt="sm">
                    Intelligence Report
                  </Text>
                  <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
                    {result.intelData.offense !== undefined && (
                      <Paper p="xs" withBorder>
                        <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Offense</Text>
                        <Text fw={600}>{result.intelData.offense.toLocaleString()}</Text>
                      </Paper>
                    )}
                    {result.intelData.defense !== undefined && (
                      <Paper p="xs" withBorder>
                        <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Defense</Text>
                        <Text fw={600}>{result.intelData.defense.toLocaleString()}</Text>
                      </Paper>
                    )}
                    {result.intelData.spy !== undefined && (
                      <Paper p="xs" withBorder>
                        <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Spy</Text>
                        <Text fw={600}>{result.intelData.spy.toLocaleString()}</Text>
                      </Paper>
                    )}
                    {result.intelData.sentry !== undefined && (
                      <Paper p="xs" withBorder>
                        <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Sentry</Text>
                        <Text fw={600}>{result.intelData.sentry.toLocaleString()}</Text>
                      </Paper>
                    )}
                    {result.intelData.gold !== undefined && (
                      <Paper p="xs" withBorder>
                        <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Gold</Text>
                        <Text fw={600}>{Number(result.intelData.gold).toLocaleString()}</Text>
                      </Paper>
                    )}
                    {result.intelData.fortHitpoints !== undefined && (
                      <Paper p="xs" withBorder>
                        <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Fort HP</Text>
                        <Text fw={600}>{result.intelData.fortHitpoints}</Text>
                      </Paper>
                    )}
                    {result.intelData.armySize !== undefined && (
                      <Paper p="xs" withBorder>
                        <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Army Size</Text>
                        <Text fw={600}>{result.intelData.armySize.toLocaleString()}</Text>
                      </Paper>
                    )}
                    {result.intelData.goldInBank !== undefined && (
                      <Paper p="xs" withBorder>
                        <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Gold in Bank</Text>
                        <Text fw={600}>{Number(result.intelData.goldInBank).toLocaleString()}</Text>
                      </Paper>
                    )}
                  </SimpleGrid>

                  {result.intelData.units && (
                    <>
                      <Text size="sm" fw={600} style={{ color: 'var(--ot-gold)' }} mt="xs">
                        Full Unit Breakdown
                      </Text>
                      <Table striped>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Type</Table.Th>
                            <Table.Th>Level</Table.Th>
                            <Table.Th ta="right">Quantity</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {(result.intelData.units as any[]).map((u: any, i: number) => (
                            <Table.Tr key={i}>
                              <Table.Td>{u.unitType}</Table.Td>
                              <Table.Td>{u.level}</Table.Td>
                              <Table.Td ta="right">{u.quantity}</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </>
                  )}
                </>
              )}
            </Stack>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}

export default function SpyPage() {
  return (
    <Suspense fallback={<Container size="lg"><Skeleton height={400} /></Container>}>
      <SpyPageContent />
    </Suspense>
  );
}
