'use client';

import { useState, useCallback } from 'react';
import {
  Title,
  Stack,
  Group,
  Tabs,
  Paper,
  NumberInput,
  Button,
  Select,
  Text,
  SimpleGrid,
  Badge,
  Grid,
  Divider,
  TextInput,
  ActionIcon,
  Table,
  Modal,
  Textarea,
  SegmentedControl,
  Accordion,
  Card,
  ScrollArea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { IconPlus, IconTrash, IconDeviceFloppy, IconFolderOpen } from '@tabler/icons-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────

interface SimulatorUnit {
  type: string;
  level: number;
  quantity: number;
}

interface SimulatorItem {
  id: string;
  quantity: number;
}

interface SimulatorProfile {
  level: number;
  race: string;
  class: string;
  offenseProficiency: number;
  defenseProficiency: number;
  spyProficiency: number;
  sentryProficiency: number;
  units: SimulatorUnit[];
  items: SimulatorItem[];
  fortHealth?: number;
  fortMaxHealth?: number;
  gold?: number;
  goldInBank?: number;
}

interface UnitCasualty {
  type: string;
  level: number;
  name: string;
  quantity: number;
  lost: number;
  remaining: number;
}

interface SingleSimResult {
  attackerWins: boolean;
  effectiveOffense: number;
  totalDefense: number;
  goldStolen: number;
  goldStolenPercent: number;
  fortDamage: number;
  attackerXP: number;
  defenderXP: number;
  turnsUsed: number;
  attackerCasualties: UnitCasualty[];
  defenderCasualties: UnitCasualty[];
  attackerTotalUnitsLost: number;
  defenderTotalUnitsLost: number;
  attackerBreakdown: any;
  defenderBreakdown: any;
}

interface BatchSimResult {
  runs: number;
  winRate: number;
  avgGoldStolen: number;
  avgFortDamage: number;
  avgAttackerXP: number;
  avgDefenderXP: number;
  avgAttackerCasualties: number;
  avgDefenderCasualties: number;
  goldStolenBuckets: { label: string; count: number }[];
  attackerCasualtyBuckets: { label: string; count: number }[];
  defenderCasualtyBuckets: { label: string; count: number }[];
  fortDamageBuckets: { label: string; count: number }[];
}

interface SavedSimulation {
  id: string;
  title: string;
  notes: string | null;
  runs: number;
  created_at: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const RACES = ['HUMAN', 'ELF', 'GOBLIN', 'UNDEAD'];
const CLASSES = ['FIGHTER', 'CLERIC', 'ASSASSIN', 'THIEF'];
const UNIT_TYPES = ['OFFENSE', 'DEFENSE', 'SPY', 'SENTRY'];
const UNIT_LEVELS = [1, 2, 3, 4];

// Common items (you can expand this list)
const ITEM_IDS = [
  'OFF-WPN-1', 'OFF-WPN-2', 'OFF-WPN-3', 'OFF-WPN-4', 'OFF-WPN-5',
  'DEF-ARM-1', 'DEF-ARM-2', 'DEF-ARM-3', 'DEF-ARM-4', 'DEF-ARM-5',
  'OFF-HELM-1', 'OFF-HELM-2', 'OFF-HELM-3',
  'DEF-SHLD-1', 'DEF-SHLD-2', 'DEF-SHLD-3',
];

const DEFAULT_PROFILE: SimulatorProfile = {
  level: 5,
  race: 'HUMAN',
  class: 'FIGHTER',
  offenseProficiency: 1,
  defenseProficiency: 1,
  spyProficiency: 0,
  sentryProficiency: 0,
  units: [],
  items: [],
  fortHealth: 1000,
  fortMaxHealth: 1000,
  gold: 10000,
  goldInBank: 5000,
};

// ─── Profile Builder Component ──────────────────────────────────────

function ProfileBuilder({
  label,
  profile,
  onChange,
  showFort = true,
  showGold = true,
}: {
  label: string;
  profile: SimulatorProfile;
  onChange: (p: SimulatorProfile) => void;
  showFort?: boolean;
  showGold?: boolean;
}) {
  const addUnit = () => {
    onChange({
      ...profile,
      units: [...profile.units, { type: 'OFFENSE', level: 1, quantity: 10 }],
    });
  };

  const removeUnit = (index: number) => {
    onChange({
      ...profile,
      units: profile.units.filter((_, i) => i !== index),
    });
  };

  const updateUnit = (index: number, field: keyof SimulatorUnit, value: any) => {
    const newUnits = [...profile.units];
    const unit = newUnits[index];
    if (unit) {
      newUnits[index] = { ...unit, [field]: value };
      onChange({ ...profile, units: newUnits });
    }
  };

  const addItem = () => {
    onChange({
      ...profile,
      items: [...profile.items, { id: 'OFF-WPN-1', quantity: 1 }],
    });
  };

  const removeItem = (index: number) => {
    onChange({
      ...profile,
      items: profile.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index: number, field: keyof SimulatorItem, value: any) => {
    const newItems = [...profile.items];
    const item = newItems[index];
    if (item) {
      newItems[index] = { ...item, [field]: value };
      onChange({ ...profile, items: newItems });
    }
  };

  return (
    <Paper p="md" withBorder style={{ borderColor: 'var(--ot-border)' }}>
      <Text fw={600} size="sm" mb="sm" style={{ color: 'var(--ot-gold)' }}>
        {label}
      </Text>

      {/* Basic Stats */}
      <SimpleGrid cols={4} spacing="xs" mb="md">
        <NumberInput
          size="xs"
          label="Level"
          value={profile.level}
          onChange={(v) => onChange({ ...profile, level: Number(v) || 1 })}
          min={1}
          max={100}
        />
        <Select
          size="xs"
          label="Race"
          value={profile.race}
          onChange={(v) => onChange({ ...profile, race: v || 'HUMAN' })}
          data={RACES}
        />
        <Select
          size="xs"
          label="Class"
          value={profile.class}
          onChange={(v) => onChange({ ...profile, class: v || 'FIGHTER' })}
          data={CLASSES}
        />
        <div />
      </SimpleGrid>

      {/* Proficiencies */}
      <SimpleGrid cols={4} spacing="xs" mb="md">
        <NumberInput
          size="xs"
          label="Offense Prof"
          value={profile.offenseProficiency}
          onChange={(v) => onChange({ ...profile, offenseProficiency: Number(v) || 0 })}
          min={0}
          max={10}
        />
        <NumberInput
          size="xs"
          label="Defense Prof"
          value={profile.defenseProficiency}
          onChange={(v) => onChange({ ...profile, defenseProficiency: Number(v) || 0 })}
          min={0}
          max={10}
        />
        <NumberInput
          size="xs"
          label="Spy Prof"
          value={profile.spyProficiency}
          onChange={(v) => onChange({ ...profile, spyProficiency: Number(v) || 0 })}
          min={0}
          max={10}
        />
        <NumberInput
          size="xs"
          label="Sentry Prof"
          value={profile.sentryProficiency}
          onChange={(v) => onChange({ ...profile, sentryProficiency: Number(v) || 0 })}
          min={0}
          max={10}
        />
      </SimpleGrid>

      {/* Fort */}
      {showFort && (
        <SimpleGrid cols={2} spacing="xs" mb="md">
          <NumberInput
            size="xs"
            label="Fort Health"
            value={profile.fortHealth}
            onChange={(v) => onChange({ ...profile, fortHealth: Number(v) || 0 })}
            min={0}
          />
          <NumberInput
            size="xs"
            label="Fort Max Health"
            value={profile.fortMaxHealth}
            onChange={(v) => onChange({ ...profile, fortMaxHealth: Number(v) || 0 })}
            min={0}
          />
        </SimpleGrid>
      )}

      {/* Gold */}
      {showGold && (
        <SimpleGrid cols={2} spacing="xs" mb="md">
          <NumberInput
            size="xs"
            label="Gold (hand)"
            value={profile.gold}
            onChange={(v) => onChange({ ...profile, gold: Number(v) || 0 })}
            min={0}
            step={1000}
          />
          <NumberInput
            size="xs"
            label="Gold (bank)"
            value={profile.goldInBank}
            onChange={(v) => onChange({ ...profile, goldInBank: Number(v) || 0 })}
            min={0}
            step={1000}
          />
        </SimpleGrid>
      )}

      <Divider my="md" label="Units" labelPosition="center" />

      {/* Units Table */}
      {profile.units.length > 0 && (
        <Table mb="xs" striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Level</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th style={{ width: 40 }}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {profile.units.map((unit, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Select
                    size="xs"
                    value={unit.type}
                    onChange={(v) => updateUnit(index, 'type', v || 'OFFENSE')}
                    data={UNIT_TYPES}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    value={String(unit.level)}
                    onChange={(v) => updateUnit(index, 'level', parseInt(v || '1', 10))}
                    data={UNIT_LEVELS.map((l) => String(l))}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    value={unit.quantity}
                    onChange={(v) => updateUnit(index, 'quantity', Number(v) || 0)}
                    min={0}
                  />
                </Table.Td>
                <Table.Td>
                  <ActionIcon size="xs" color="red" variant="subtle" onClick={() => removeUnit(index)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addUnit} mb="md">
        Add Unit
      </Button>

      <Divider my="md" label="Items" labelPosition="center" />

      {/* Items Table */}
      {profile.items.length > 0 && (
        <Table mb="xs" striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item ID</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th style={{ width: 40 }}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {profile.items.map((item, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Select
                    size="xs"
                    value={item.id}
                    onChange={(v) => updateItem(index, 'id', v || 'OFF-WPN-1')}
                    data={ITEM_IDS}
                    searchable
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    value={item.quantity}
                    onChange={(v) => updateItem(index, 'quantity', Number(v) || 0)}
                    min={0}
                  />
                </Table.Td>
                <Table.Td>
                  <ActionIcon size="xs" color="red" variant="subtle" onClick={() => removeItem(index)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addItem}>
        Add Item
      </Button>
    </Paper>
  );
}

// ─── Results Display ────────────────────────────────────────────────

function SingleResultDisplay({ result }: { result: SingleSimResult }) {
  return (
    <Stack gap="md">
      <Group>
        <Badge size="lg" color={result.attackerWins ? 'green' : 'red'}>
          {result.attackerWins ? 'ATTACKER WINS' : 'DEFENDER WINS'}
        </Badge>
        <Text size="sm">Turns: {result.turnsUsed}</Text>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="xs">
        <Card padding="xs" withBorder>
          <Text size="xs" c="dimmed">Offense</Text>
          <Text size="lg" fw={700}>{result.effectiveOffense.toLocaleString()}</Text>
        </Card>
        <Card padding="xs" withBorder>
          <Text size="xs" c="dimmed">Defense</Text>
          <Text size="lg" fw={700}>{result.totalDefense.toLocaleString()}</Text>
        </Card>
        <Card padding="xs" withBorder>
          <Text size="xs" c="dimmed">Gold Stolen</Text>
          <Text size="lg" fw={700}>{result.goldStolen.toLocaleString()}</Text>
        </Card>
        <Card padding="xs" withBorder>
          <Text size="xs" c="dimmed">Fort Damage</Text>
          <Text size="lg" fw={700}>{result.fortDamage}</Text>
        </Card>
        <Card padding="xs" withBorder>
          <Text size="xs" c="dimmed">Atk Casualties</Text>
          <Text size="lg" fw={700} c="red">{result.attackerTotalUnitsLost}</Text>
        </Card>
        <Card padding="xs" withBorder>
          <Text size="xs" c="dimmed">Def Casualties</Text>
          <Text size="lg" fw={700} c="orange">{result.defenderTotalUnitsLost}</Text>
        </Card>
      </SimpleGrid>

      <Accordion variant="contained">
        <Accordion.Item value="casualties">
          <Accordion.Control>Casualty Breakdown</Accordion.Control>
          <Accordion.Panel>
            <SimpleGrid cols={2} spacing="md">
              <div>
                <Text size="sm" fw={600} mb="xs" c="red">Attacker Casualties</Text>
                {result.attackerCasualties.length > 0 ? (
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Unit</Table.Th>
                        <Table.Th>Lost</Table.Th>
                        <Table.Th>Remaining</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {result.attackerCasualties.map((cas, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>{cas.name} (Lv{cas.level})</Table.Td>
                          <Table.Td>{cas.lost}</Table.Td>
                          <Table.Td>{cas.remaining}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text size="xs" c="dimmed">No casualties</Text>
                )}
              </div>
              <div>
                <Text size="sm" fw={600} mb="xs" c="orange">Defender Casualties</Text>
                {result.defenderCasualties.length > 0 ? (
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Unit</Table.Th>
                        <Table.Th>Lost</Table.Th>
                        <Table.Th>Remaining</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {result.defenderCasualties.map((cas, i) => (
                        <Table.Tr key={i}>
                          <Table.Td>{cas.name} (Lv{cas.level})</Table.Td>
                          <Table.Td>{cas.lost}</Table.Td>
                          <Table.Td>{cas.remaining}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text size="xs" c="dimmed">No casualties</Text>
                )}
              </div>
            </SimpleGrid>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="breakdown">
          <Accordion.Control>Stat Breakdown</Accordion.Control>
          <Accordion.Panel>
            <SimpleGrid cols={2} spacing="md">
              <div>
                <Text size="sm" fw={600} mb="xs">Attacker</Text>
                <pre style={{ fontSize: 10, overflow: 'auto' }}>
                  {JSON.stringify(result.attackerBreakdown, null, 2)}
                </pre>
              </div>
              <div>
                <Text size="sm" fw={600} mb="xs">Defender</Text>
                <pre style={{ fontSize: 10, overflow: 'auto' }}>
                  {JSON.stringify(result.defenderBreakdown, null, 2)}
                </pre>
              </div>
            </SimpleGrid>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}

function BatchResultDisplay({ result }: { result: BatchSimResult }) {
  return (
    <Stack gap="md">
      <Text fw={600} size="lg" style={{ color: 'var(--ot-gold)' }}>
        Batch Results ({result.runs.toLocaleString()} runs)
      </Text>

      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="xs">
        <Card padding="xs" withBorder>
          <Text size="xs" c="dimmed">Win Rate</Text>
          <Text size="lg" fw={700} c={result.winRate >= 0.5 ? 'green' : 'red'}>
            {(result.winRate * 100).toFixed(1)}%
          </Text>
        </Card>
        <Card padding="xs" withBorder>
          <Text size="xs" c="dimmed">Avg Gold</Text>
          <Text size="lg" fw={700}>{result.avgGoldStolen.toLocaleString()}</Text>
        </Card>
        <Card padding="xs" withBorder>
          <Text size="xs" c="dimmed">Avg Fort Dmg</Text>
          <Text size="lg" fw={700}>{result.avgFortDamage}</Text>
        </Card>
        <Card padding="xs" withBorder>
          <Text size="xs" c="dimmed">Avg Atk Cas</Text>
          <Text size="lg" fw={700} c="red">{result.avgAttackerCasualties}</Text>
        </Card>
        <Card padding="xs" withBorder>
          <Text size="xs" c="dimmed">Avg Def Cas</Text>
          <Text size="lg" fw={700} c="orange">{result.avgDefenderCasualties}</Text>
        </Card>
        <Card padding="xs" withBorder>
          <Text size="xs" c="dimmed">Avg XP</Text>
          <Text size="lg" fw={700}>{result.avgAttackerXP}</Text>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {result.goldStolenBuckets.some((b) => b.count > 0) && (
          <Paper p="sm" withBorder>
            <Text size="xs" fw={600} mb="xs">Gold Stolen Distribution</Text>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={result.goldStolenBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#4ecdc4" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}
        {result.fortDamageBuckets.some((b) => b.count > 0) && (
          <Paper p="sm" withBorder>
            <Text size="xs" fw={600} mb="xs">Fort Damage Distribution</Text>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={result.fortDamageBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#ffa07a" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}
      </SimpleGrid>
    </Stack>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function CombatSimulatorPage() {
  console.log('[CombatSimulatorPage] Rendering...');
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();
  console.log('[CombatSimulatorPage] useApi result:', { isReady });

  const [attacker, setAttacker] = useState<SimulatorProfile>({ ...DEFAULT_PROFILE });
  const [defender, setDefender] = useState<SimulatorProfile>({ ...DEFAULT_PROFILE });
  const [turnsUsed, setTurnsUsed] = useState(3);
  const [runs, setRuns] = useState(1);
  const [result, setResult] = useState<SingleSimResult | BatchSimResult | null>(null);
  console.log('[CombatSimulatorPage] State initialized');

  // Save modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveNotes, setSaveNotes] = useState('');

  // Load modal
  const [loadModalOpen, setLoadModalOpen] = useState(false);

  // Get saved simulations
  const { data: savedSimulations = [] } = useQuery<SavedSimulation[]>({
    queryKey: ['simulator', 'saved'],
    queryFn: () => api.get('/simulator/saved'),
    enabled: isReady,
  });

  // Simulate mutation
  const simulateMutation = useMutation({
    mutationFn: (body: any) =>
      api.post('/simulator/simulate', body) as Promise<SingleSimResult | BatchSimResult>,
    onSuccess: (data) => {
      setResult(data);
      notifications.show({ title: 'Success', message: 'Simulation complete', color: 'green' });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (body: any) => api.post('/simulator/save', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulator', 'saved'] });
      setSaveModalOpen(false);
      setSaveTitle('');
      setSaveNotes('');
      notifications.show({ title: 'Saved', message: 'Simulation saved successfully', color: 'green' });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  // Load mutation
  const loadMutation = useMutation({
    mutationFn: (id: string) => api.get(`/simulator/saved/${id}`) as Promise<any>,
    onSuccess: (data) => {
      if (data.input) {
        setAttacker(data.input.attacker);
        setDefender(data.input.defender);
        setTurnsUsed(data.input.turnsUsed || 3);
        setRuns(data.runs || 1);
      }
      if (data.result) {
        setResult(data.result);
      }
      setLoadModalOpen(false);
      notifications.show({ title: 'Loaded', message: 'Simulation loaded successfully', color: 'green' });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/simulator/saved/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['simulator', 'saved'] });
      notifications.show({ title: 'Deleted', message: 'Simulation deleted', color: 'green' });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  const handleSimulate = useCallback(() => {
    simulateMutation.mutate({
      attacker,
      defender,
      turnsUsed,
      runs,
    });
  }, [attacker, defender, turnsUsed, runs]);

  const handleSave = useCallback(() => {
    if (!result) return;
    saveMutation.mutate({
      title: saveTitle,
      notes: saveNotes,
      runs,
      input: { attacker, defender, turnsUsed },
      result,
    });
  }, [result, saveTitle, saveNotes, runs, attacker, defender, turnsUsed]);

  console.log('[CombatSimulatorPage] About to render JSX');

  if (!isReady) {
    console.log('[CombatSimulatorPage] Not ready, showing loading...');
    return <Text>Loading...</Text>;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3} style={{ color: 'var(--ot-gold)' }}>
          Combat Simulator
        </Title>
        <Group>
          <Button
            size="sm"
            variant="light"
            leftSection={<IconFolderOpen size={16} />}
            onClick={() => setLoadModalOpen(true)}
          >
            Load
          </Button>
          {result && (
            <Button
              size="sm"
              variant="light"
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={() => setSaveModalOpen(true)}
            >
              Save
            </Button>
          )}
        </Group>
      </Group>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <ProfileBuilder
            label="ATTACKER"
            profile={attacker}
            onChange={setAttacker}
            showFort={false}
            showGold={false}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <ProfileBuilder label="DEFENDER" profile={defender} onChange={setDefender} />
        </Grid.Col>
      </Grid>

      {/* Controls */}
      <Paper p="md" withBorder style={{ borderColor: 'var(--ot-border)' }}>
        <Group>
          <NumberInput
            label="Turns Used"
            size="sm"
            value={turnsUsed}
            onChange={(v) => setTurnsUsed(Number(v) || 1)}
            min={1}
            max={10}
            style={{ width: 120 }}
          />
          <SegmentedControl
            size="sm"
            value={String(runs)}
            onChange={(v) => setRuns(parseInt(v, 10))}
            data={[
              { label: '1', value: '1' },
              { label: '100', value: '100' },
              { label: '1,000', value: '1000' },
              { label: '10,000', value: '10000' },
            ]}
          />
          <Button
            onClick={handleSimulate}
            loading={simulateMutation.isPending}
            style={{ backgroundColor: 'var(--ot-gold)', color: '#000' }}
          >
            Simulate
          </Button>
        </Group>
      </Paper>

      {/* Results */}
      {result && (
        <>
          {runs === 1 ? (
            <SingleResultDisplay result={result as SingleSimResult} />
          ) : (
            <BatchResultDisplay result={result as BatchSimResult} />
          )}
        </>
      )}

      {/* Save Modal */}
      <Modal
        opened={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save Simulation"
      >
        <Stack>
          <TextInput
            label="Title"
            placeholder="My Battle Scenario"
            value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
          />
          <Textarea
            label="Notes"
            placeholder="Optional notes..."
            value={saveNotes}
            onChange={(e) => setSaveNotes(e.target.value)}
            rows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setSaveModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saveMutation.isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Load Modal */}
      <Modal
        opened={loadModalOpen}
        onClose={() => setLoadModalOpen(false)}
        title="Load Simulation"
        size="lg"
      >
        <ScrollArea h={400}>
          {savedSimulations.length === 0 ? (
            <Text c="dimmed" ta="center">No saved simulations</Text>
          ) : (
            <Stack gap="xs">
              {savedSimulations.map((sim) => (
                <Paper key={sim.id} p="sm" withBorder>
                  <Group justify="space-between">
                    <div>
                      <Text fw={600} size="sm">
                        {sim.title}
                      </Text>
                      {sim.notes && (
                        <Text size="xs" c="dimmed">
                          {sim.notes}
                        </Text>
                      )}
                      <Text size="xs" c="dimmed">
                        {new Date(sim.created_at).toLocaleDateString()} • {sim.runs} run
                        {sim.runs > 1 ? 's' : ''}
                      </Text>
                    </div>
                    <Group>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => loadMutation.mutate(sim.id)}
                        loading={loadMutation.isPending}
                      >
                        Load
                      </Button>
                      <ActionIcon
                        size="sm"
                        color="red"
                        variant="subtle"
                        onClick={() => deleteMutation.mutate(sim.id)}
                        loading={deleteMutation.isPending}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </ScrollArea>
      </Modal>
    </Stack>
  );
}
