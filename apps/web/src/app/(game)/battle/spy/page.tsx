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
import { OTCard } from '@/components/ui';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useApi } from '@/hooks/use-api';
import { updatePlayerCache } from '@/lib/cache-sync';
import type { PlayerStateSnapshot } from '@openthrone/shared';

interface PlayerEntry {
  id: string;
  displayName: string;
  race: string;
  class: string;
  level: number;
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
  attackLogId?: number;
  goldStolen?: string;
  destroyedItems?: { itemType: string; usage: string; level: number }[];
  playerState: PlayerStateSnapshot;
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
      // Update cache with fresh state (instant feedback!)
      updatePlayerCache(queryClient, data.playerState);

      // Still invalidate battle queries (history, etc.)
      queryClient.invalidateQueries({ queryKey: ['battle'] });

      setResult(data);
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

  const shareIntelMutation = useMutation({
    mutationFn: (attackLogId: number) =>
      api.post('/battle/intel/share', { attackLogId }),
    onSuccess: () => {
      notifications.show({ title: 'Intel Shared', message: 'Intel report shared with your alliance.', color: 'green' });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Share Failed', message: err.message, color: 'red' });
    },
  });

  const handleExecuteMission = () => {
    if (!selectedTarget) return;
    const missionTypeMap: Record<string, string> = {
      intel: 'INTEL',
      assassinate: 'ASSASSINATE',
      infiltrate: 'INFILTRATE',
      steal_gold: 'STEAL_GOLD',
      sabotage: 'SABOTAGE',
    };
    const missionType = missionTypeMap[missionTab] ?? 'INTEL';

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
        <Title order={2}>
          Spy Missions
        </Title>

        {/* Target Selection */}
        <OTCard>
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
        </OTCard>

        {/* Mission Tabs */}
        {selectedTarget && (
          <Tabs value={missionTab} onChange={(v) => { setMissionTab(v ?? 'intel'); setResult(null); }}>
            <Tabs.List>
              <Tabs.Tab value="intel">Intel (3,000g / 2 turns)</Tabs.Tab>
              <Tabs.Tab value="assassinate">Assassination (1 turn)</Tabs.Tab>
              <Tabs.Tab value="infiltrate">Infiltration (1 turn)</Tabs.Tab>
              <Tabs.Tab value="steal_gold">Steal Gold (10,000g / 5 turns)</Tabs.Tab>
              <Tabs.Tab value="sabotage">Sabotage (10,000g / 5 turns)</Tabs.Tab>
            </Tabs.List>

            {/* Intel Tab */}
            <Tabs.Panel value="intel" pt="md">
              <OTCard>
                <Stack gap="sm">
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    Send spies to gather intelligence on the target. Each spy reveals 10% of their information.
                    Costs 3,000 gold and 2 attack turns.
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
                    Send Spies (3,000g)
                  </Button>
                </Stack>
              </OTCard>
            </Tabs.Panel>

            {/* Assassination Tab */}
            <Tabs.Panel value="assassinate" pt="md">
              <OTCard>
                <Stack gap="sm">
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    Send assassins to eliminate specific enemy units.
                    Higher risk but can take out key units.
                  </Text>
                  <Badge color="blue" variant="light">Requires Spy Academy Level 1</Badge>
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
              </OTCard>
            </Tabs.Panel>

            {/* Infiltration Tab */}
            <Tabs.Panel value="infiltrate" pt="md">
              <OTCard>
                <Stack gap="sm">
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    Send infiltrators to sabotage the enemy&apos;s fortifications.
                    Deals direct damage to their fort hitpoints.
                  </Text>
                  <Badge color="blue" variant="light">Requires Spy Academy Level 1</Badge>
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
              </OTCard>
            </Tabs.Panel>

            {/* Steal Gold Tab */}
            <Tabs.Panel value="steal_gold" pt="md">
              <OTCard>
                <Stack gap="sm">
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    Send spies to steal gold from the target&apos;s coffers. Steals 5-10% of their hand gold on success.
                    High risk: 50% spy loss on failure. Costs 10,000 gold and 5 attack turns.
                  </Text>
                  <Badge color="orange" variant="light">Requires Spy Academy Level 2</Badge>
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
                    color="yellow"
                    w={200}
                  >
                    Steal Gold (10,000g)
                  </Button>
                </Stack>
              </OTCard>
            </Tabs.Panel>

            {/* Sabotage Tab */}
            <Tabs.Panel value="sabotage" pt="md">
              <OTCard>
                <Stack gap="sm">
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    Send spies to destroy the enemy&apos;s equipped items. Destroys 3-5 random items on success.
                    High risk: 50% spy loss on failure. Costs 10,000 gold and 5 attack turns.
                  </Text>
                  <Badge color="orange" variant="light">Requires Spy Academy Level 2</Badge>
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
                    color="grape"
                    w={200}
                  >
                    Sabotage (10,000g)
                  </Button>
                </Stack>
              </OTCard>
            </Tabs.Panel>
          </Tabs>
        )}

        {/* Results */}
        {result && (
          <OTCard>
            <Stack gap="sm">
              <Group>
                <Text fw={600} style={{ color: result.success ? 'var(--ot-success)' : 'var(--ot-danger)' }}>
                  {result.success ? 'Mission Successful' : 'Mission Failed'}
                </Text>
                <Badge color={result.success ? 'green' : 'red'} variant="light">
                  {result.missionType.toUpperCase().replace('_', ' ')}
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
                <Paper p="xs" withBorder>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Spies Lost</Text>
                  <Text fw={600} style={{ color: 'var(--ot-danger)' }}>{result.spiesLost}</Text>
                </Paper>
                <Paper p="xs" withBorder>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Spies Survived</Text>
                  <Text fw={600} style={{ color: 'var(--ot-success)' }}>{result.spiesSurvived}</Text>
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
                    <Text fw={600} c="grape">
                      {result.unitsKilled} {result.targetUnitType}
                    </Text>
                  </Paper>
                )}

                {result.fortDamage !== undefined && result.fortDamage > 0 && (
                  <Paper p="xs" withBorder>
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Fort Damage</Text>
                    <Text fw={600} style={{ color: 'var(--ot-warning)' }}>{result.fortDamage}</Text>
                  </Paper>
                )}

                {result.goldStolen !== undefined && Number(result.goldStolen) > 0 && (
                  <Paper p="xs" withBorder>
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Gold Stolen</Text>
                    <Text fw={600} style={{ color: 'var(--ot-success)' }}>
                      {Number(result.goldStolen).toLocaleString()}
                    </Text>
                  </Paper>
                )}
              </SimpleGrid>

              {/* Sabotage: destroyed items list */}
              {result.destroyedItems && result.destroyedItems.length > 0 && (
                <>
                  <Text fw={600} style={{ color: 'var(--ot-danger)' }} mt="sm">
                    Items Destroyed
                  </Text>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Item</Table.Th>
                        <Table.Th>Usage</Table.Th>
                        <Table.Th ta="right">Level</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {result.destroyedItems.map((item, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>{item.itemType}</Table.Td>
                          <Table.Td>{item.usage}</Table.Td>
                          <Table.Td ta="right">{item.level}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </>
              )}

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

                  {/* Save to Alliance button */}
                  {result.attackLogId && (
                    <Button
                      variant="light"
                      color="blue"
                      onClick={() => shareIntelMutation.mutate(result.attackLogId!)}
                      loading={shareIntelMutation.isPending}
                      disabled={shareIntelMutation.isSuccess}
                      mt="sm"
                    >
                      {shareIntelMutation.isSuccess ? 'Shared with Alliance' : 'Save to Alliance'}
                    </Button>
                  )}
                </>
              )}
            </Stack>
          </OTCard>
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
