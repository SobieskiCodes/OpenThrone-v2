'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Title,
  Stack,
  Group,
  Tabs,
  Paper,
  NumberInput,
  Button,
  Select,
  Accordion,
  Slider,
  Text,
  SimpleGrid,
  Loader,
  Center,
  SegmentedControl,
  TextInput,
  Badge,
  Card,
  Grid,
  Divider,
  Switch,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
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

interface CombatProfile {
  offense: number;
  defense: number;
  spy: number;
  sentry: number;
  gold: number;
  goldInBank: number;
  fortLevel: number;
  fortHitpoints: number;
  level: number;
  population: number;
  offenseUnits: number;
  defenseUnits: number;
  spyUnits: number;
  sentryUnits: number;
  citizenUnits: number;
}

interface SimulationSummary {
  runs: number;
  type: string;
  winRate: number;
  avgGoldStolen: number;
  avgAttackerCasualties: number;
  avgDefenderCasualties: number;
  avgFortDamage: number;
  avgAttackerXP: number;
  avgDefenderXP: number;
  goldStolenBuckets: { label: string; count: number }[];
  attackerCasualtyBuckets: { label: string; count: number }[];
  defenderCasualtyBuckets: { label: string; count: number }[];
  fortDamageBuckets: { label: string; count: number }[];
  avgRevealPercent?: number;
  avgUnitsKilled?: number;
  avgSpiesLost?: number;
}

interface SimResponse {
  attacker: CombatProfile;
  defender: CombatProfile;
  config: Record<string, number>;
  summary: SimulationSummary;
}

interface PlayerSearchResult {
  id: string;
  displayName: string;
  race: string;
  class: string;
  level: number;
}

type ProfileMode = 'custom' | 'player';

// ─── Default Profile ────────────────────────────────────────────────

const DEFAULT_PROFILE: CombatProfile = {
  offense: 500,
  defense: 500,
  spy: 200,
  sentry: 200,
  gold: 50000,
  goldInBank: 0,
  fortLevel: 1,
  fortHitpoints: 50,
  level: 5,
  population: 200,
  offenseUnits: 80,
  defenseUnits: 60,
  spyUnits: 20,
  sentryUnits: 20,
  citizenUnits: 20,
};

// ─── Config Sections ────────────────────────────────────────────────

interface ConfigField {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  precision?: number;
}

const CONFIG_SECTIONS: { title: string; fields: ConfigField[] }[] = [
  {
    title: 'Strength & Variance',
    fields: [
      { key: 'strengthVarianceMin', label: 'Variance Min', min: 0.5, max: 1.0, step: 0.01, precision: 2 },
      { key: 'strengthVarianceMax', label: 'Variance Max', min: 1.0, max: 1.5, step: 0.01, precision: 2 },
      { key: 'fortDefenseMultiplier', label: 'Fort Defense Multiplier', min: 0, max: 1.0, step: 0.05, precision: 2 },
    ],
  },
  {
    title: 'Casualty Rates',
    fields: [
      { key: 'attackerCasualtyBase', label: 'Attacker Casualty Base', min: 0.001, max: 0.1, step: 0.001, precision: 3 },
      { key: 'defenderCasualtyBase', label: 'Defender Casualty Base', min: 0.001, max: 0.1, step: 0.001, precision: 3 },
      { key: 'defenderCasualtyOnWin', label: 'Defender Cas (Def Wins)', min: 0, max: 0.05, step: 0.001, precision: 3 },
      { key: 'maxCasualtyPercent', label: 'Max Casualty %', min: 0.01, max: 0.2, step: 0.005, precision: 3 },
      { key: 'defenseUnitCasualtyShare', label: 'Def Unit Cas Share', min: 0.1, max: 1.0, step: 0.05, precision: 2 },
      { key: 'citizenVulnerabilityThreshold', label: 'Citizen Vuln Threshold', min: 0.05, max: 0.5, step: 0.05, precision: 2 },
      { key: 'citizenCasualtyShare', label: 'Citizen Casualty Share', min: 0, max: 0.5, step: 0.05, precision: 2 },
    ],
  },
  {
    title: 'Gold Theft',
    fields: [
      { key: 'goldTheftBasePercent', label: 'Base Theft %', min: 0.01, max: 0.3, step: 0.01, precision: 2 },
      { key: 'goldTheftVarianceMin', label: 'Theft Variance Min', min: 0.5, max: 1.0, step: 0.05, precision: 2 },
      { key: 'goldTheftVarianceMax', label: 'Theft Variance Max', min: 1.0, max: 2.0, step: 0.05, precision: 2 },
      { key: 'goldTheftMaxPercent', label: 'Max Theft %', min: 0.05, max: 0.5, step: 0.05, precision: 2 },
    ],
  },
  {
    title: 'Fort Damage',
    fields: [
      { key: 'fortDamageBase', label: 'Base Damage', min: 0, max: 20, step: 1 },
      { key: 'fortDamageVariance', label: 'Damage Variance', min: 0, max: 20, step: 1 },
      { key: 'fortDamageRatioScaler', label: 'Ratio Scaler', min: 0, max: 2, step: 0.1, precision: 1 },
    ],
  },
  {
    title: 'XP',
    fields: [
      { key: 'xpBase', label: 'Base XP', min: 100, max: 2000, step: 50 },
      { key: 'xpWinnerMultiplier', label: 'Winner Multiplier', min: 0.1, max: 1.0, step: 0.05, precision: 2 },
      { key: 'xpLoserMultiplier', label: 'Loser Multiplier', min: 0.05, max: 0.5, step: 0.05, precision: 2 },
      { key: 'xpLevelDiffBonus', label: 'Level Diff Bonus', min: 0, max: 200, step: 10 },
    ],
  },
  {
    title: 'Spy: Intel',
    fields: [
      { key: 'intelRevealPerSpy', label: 'Reveal % Per Spy', min: 1, max: 30, step: 1 },
      { key: 'intelMaxReveal', label: 'Max Reveal %', min: 50, max: 100, step: 10 },
      { key: 'intelSpyLossOnFail', label: 'Spy Loss On Fail', min: 0, max: 1.0, step: 0.1, precision: 1 },
      { key: 'intelSpyLossOnSuccess', label: 'Spy Loss On Success', min: 0, max: 0.5, step: 0.05, precision: 2 },
    ],
  },
  {
    title: 'Spy: Assassination',
    fields: [
      { key: 'assassinKillBase', label: 'Kill Base Rate', min: 0.005, max: 0.1, step: 0.005, precision: 3 },
      { key: 'assassinKillVarianceMin', label: 'Kill Variance Min', min: 0.5, max: 1.0, step: 0.05, precision: 2 },
      { key: 'assassinKillVarianceMax', label: 'Kill Variance Max', min: 1.0, max: 2.0, step: 0.05, precision: 2 },
      { key: 'assassinSpyLossOnFail', label: 'Spy Loss On Fail', min: 0, max: 1.0, step: 0.1, precision: 1 },
      { key: 'assassinSpyLossOnSuccess', label: 'Spy Loss On Success', min: 0, max: 0.5, step: 0.05, precision: 2 },
    ],
  },
  {
    title: 'Spy: Infiltration',
    fields: [
      { key: 'infiltrationDamagePerSpy', label: 'Damage Per Spy', min: 1, max: 30, step: 1 },
      { key: 'infiltrationDamageVariance', label: 'Damage Variance', min: 0, max: 15, step: 1 },
      { key: 'infiltrationSpyLossOnFail', label: 'Spy Loss On Fail', min: 0, max: 1.0, step: 0.1, precision: 1 },
      { key: 'infiltrationSpyLossOnSuccess', label: 'Spy Loss On Success', min: 0, max: 0.5, step: 0.05, precision: 2 },
    ],
  },
];

// ─── Profile Builder Component ──────────────────────────────────────

function ProfileBuilder({
  label,
  profile,
  onChange,
  api,
  isReady,
}: {
  label: string;
  profile: CombatProfile;
  onChange: (p: CombatProfile) => void;
  api: any;
  isReady: boolean;
}) {
  const [mode, setMode] = useState<ProfileMode>('custom');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadedPlayer, setLoadedPlayer] = useState<string | null>(null);

  const { data: searchResults } = useQuery<{ data: PlayerSearchResult[] }>({
    queryKey: ['admin', 'combat-sim', 'search', searchQuery],
    queryFn: () => api.get(`/battle/players?search=${encodeURIComponent(searchQuery)}&limit=10`),
    enabled: isReady && mode === 'player' && searchQuery.length >= 2,
  });

  const loadProfileMutation = useMutation({
    mutationFn: (playerId: string) =>
      api.get(`/admin/combat-sim/player/${playerId}/profile`) as Promise<CombatProfile>,
    onSuccess: (data: CombatProfile) => {
      onChange(data);
      notifications.show({ title: 'Profile Loaded', message: 'Player profile loaded', color: 'green' });
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  const playerOptions = (searchResults?.data ?? []).map((p) => ({
    value: p.id,
    label: `${p.displayName} (Lv ${p.level}, ${p.race})`,
  }));

  const updateField = (key: keyof CombatProfile, value: number) => {
    onChange({ ...profile, [key]: value });
  };

  return (
    <Paper p="md" withBorder style={{ borderColor: 'var(--ot-border)' }}>
      <Group justify="space-between" mb="sm">
        <Text fw={600} size="sm" style={{ color: 'var(--ot-gold)' }}>{label}</Text>
        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(v) => setMode(v as ProfileMode)}
          data={[
            { label: 'Custom', value: 'custom' },
            { label: 'Load Player', value: 'player' },
          ]}
        />
      </Group>

      {mode === 'player' && (
        <Stack gap="xs" mb="sm">
          <TextInput
            placeholder="Search player name..."
            size="xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {playerOptions.length > 0 && (
            <Select
              size="xs"
              placeholder="Select player"
              data={playerOptions}
              value={loadedPlayer}
              onChange={(val) => {
                if (val) {
                  setLoadedPlayer(val);
                  loadProfileMutation.mutate(val);
                }
              }}
            />
          )}
        </Stack>
      )}

      <SimpleGrid cols={3} spacing="xs">
        <NumberInput size="xs" label="Offense" value={profile.offense} onChange={(v) => updateField('offense', Number(v) || 0)} min={0} />
        <NumberInput size="xs" label="Defense" value={profile.defense} onChange={(v) => updateField('defense', Number(v) || 0)} min={0} />
        <NumberInput size="xs" label="Spy" value={profile.spy} onChange={(v) => updateField('spy', Number(v) || 0)} min={0} />
        <NumberInput size="xs" label="Sentry" value={profile.sentry} onChange={(v) => updateField('sentry', Number(v) || 0)} min={0} />
        <NumberInput size="xs" label="Gold (hand)" value={profile.gold} onChange={(v) => updateField('gold', Number(v) || 0)} min={0} step={1000} />
        <NumberInput size="xs" label="Level" value={profile.level} onChange={(v) => updateField('level', Number(v) || 1)} min={1} />
        <NumberInput size="xs" label="Fort Level" value={profile.fortLevel} onChange={(v) => updateField('fortLevel', Number(v) || 1)} min={1} max={24} />
        <NumberInput size="xs" label="Fort HP" value={profile.fortHitpoints} onChange={(v) => updateField('fortHitpoints', Number(v) || 0)} min={0} />
        <NumberInput size="xs" label="Population" value={profile.population} onChange={(v) => updateField('population', Number(v) || 0)} min={0} />
        <NumberInput size="xs" label="Off Units" value={profile.offenseUnits} onChange={(v) => updateField('offenseUnits', Number(v) || 0)} min={0} />
        <NumberInput size="xs" label="Def Units" value={profile.defenseUnits} onChange={(v) => updateField('defenseUnits', Number(v) || 0)} min={0} />
        <NumberInput size="xs" label="Spy Units" value={profile.spyUnits} onChange={(v) => updateField('spyUnits', Number(v) || 0)} min={0} />
        <NumberInput size="xs" label="Sentry Units" value={profile.sentryUnits} onChange={(v) => updateField('sentryUnits', Number(v) || 0)} min={0} />
        <NumberInput size="xs" label="Citizens" value={profile.citizenUnits} onChange={(v) => updateField('citizenUnits', Number(v) || 0)} min={0} />
      </SimpleGrid>
    </Paper>
  );
}

// ─── Config Sliders Component ───────────────────────────────────────

function ConfigSliders({
  config,
  onChange,
  onReset,
}: {
  config: Record<string, number>;
  onChange: (c: Record<string, number>) => void;
  onReset: () => void;
}) {
  const updateField = (key: string, value: number) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <Paper p="md" withBorder style={{ borderColor: 'var(--ot-border)' }}>
      <Group justify="space-between" mb="sm">
        <Text fw={600} size="sm" style={{ color: 'var(--ot-gold)' }}>Config</Text>
        <Button size="xs" variant="subtle" onClick={onReset}>Reset Defaults</Button>
      </Group>

      <Accordion variant="contained" multiple>
        {CONFIG_SECTIONS.map((section) => (
          <Accordion.Item key={section.title} value={section.title}>
            <Accordion.Control>
              <Text size="xs" fw={500}>{section.title}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                {section.fields.map((field) => (
                  <div key={field.key}>
                    <Group justify="space-between" mb={4}>
                      <Text size="xs">{field.label}</Text>
                      <NumberInput
                        size="xs"
                        w={90}
                        value={config[field.key] ?? 0}
                        onChange={(v) => updateField(field.key, Number(v) || 0)}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        decimalScale={field.precision ?? 0}
                      />
                    </Group>
                    <Slider
                      size="xs"
                      value={config[field.key] ?? 0}
                      onChange={(v) => updateField(field.key, v)}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      marks={[
                        { value: field.min, label: String(field.min) },
                        { value: field.max, label: String(field.max) },
                      ]}
                    />
                  </div>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Paper>
  );
}

// ─── Histogram Chart ────────────────────────────────────────────────

function HistogramChart({
  title,
  data,
  color = '#d4a24e',
}: {
  title: string;
  data: { label: string; count: number }[];
  color?: string;
}) {
  if (!data || data.length === 0) return null;

  return (
    <Paper p="sm" withBorder style={{ borderColor: 'var(--ot-border)' }}>
      <Text size="xs" fw={600} mb="xs" style={{ color: 'var(--ot-gold)' }}>{title}</Text>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#999' }} angle={-30} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: '#999' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 4 }}
            labelStyle={{ color: '#d4a24e' }}
          />
          <Bar dataKey="count" fill={color} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────

function StatCard({ label, value, color = 'var(--ot-gold)' }: { label: string; value: string | number; color?: string }) {
  return (
    <Paper p="sm" withBorder style={{ borderColor: 'var(--ot-border)', textAlign: 'center' }}>
      <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>{label}</Text>
      <Text size="lg" fw={700} style={{ color }}>{value}</Text>
    </Paper>
  );
}

// ─── Comparison Panel ───────────────────────────────────────────────

function ComparisonPanel({ savedRuns }: { savedRuns: { name: string; summary: SimulationSummary }[] }) {
  if (savedRuns.length < 2) return null;

  const comparisonData = savedRuns.map((run) => ({
    name: run.name,
    'Win Rate': Math.round(run.summary.winRate * 100),
    'Avg Gold': run.summary.avgGoldStolen,
    'Atk Cas': run.summary.avgAttackerCasualties,
    'Def Cas': run.summary.avgDefenderCasualties,
    'Fort Dmg': run.summary.avgFortDamage,
  }));

  return (
    <Paper p="md" withBorder style={{ borderColor: 'var(--ot-border)' }}>
      <Text fw={600} size="sm" mb="sm" style={{ color: 'var(--ot-gold)' }}>
        Comparison ({savedRuns.length} runs)
      </Text>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={comparisonData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#999' }} />
          <YAxis tick={{ fontSize: 10, fill: '#999' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 4 }}
            labelStyle={{ color: '#d4a24e' }}
          />
          <Legend />
          <Bar dataKey="Win Rate" fill="#d4a24e" />
          <Bar dataKey="Avg Gold" fill="#4ecdc4" />
          <Bar dataKey="Atk Cas" fill="#ff6b6b" />
          <Bar dataKey="Def Cas" fill="#c44dff" />
          <Bar dataKey="Fort Dmg" fill="#ffa07a" />
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function AdminCombatSimPage() {
  const { api, isReady } = useApi();
  const [simType, setSimType] = useState('attack');
  const [runs, setRuns] = useState(1000);
  const [attacker, setAttacker] = useState<CombatProfile>({ ...DEFAULT_PROFILE });
  const [defender, setDefender] = useState<CombatProfile>({ ...DEFAULT_PROFILE });
  const [config, setConfig] = useState<Record<string, number>>({});
  const [configLoaded, setConfigLoaded] = useState(false);
  const [result, setResult] = useState<SimResponse | null>(null);
  const [savedRuns, setSavedRuns] = useState<{ name: string; summary: SimulationSummary }[]>([]);

  // Spy options
  const [spiesSent, setSpiesSent] = useState(5);
  const [targetUnitType, setTargetUnitType] = useState('OFFENSE');

  // Load default config
  const { data: defaultConfig } = useQuery<Record<string, number>>({
    queryKey: ['admin', 'combat-sim', 'default-config'],
    queryFn: () => api.get('/admin/combat-sim/default-config'),
    enabled: isReady && !configLoaded,
  });

  useEffect(() => {
    if (defaultConfig && !configLoaded) {
      setConfig(defaultConfig);
      setConfigLoaded(true);
    }
  }, [defaultConfig, configLoaded]);

  const simulateMutation = useMutation({
    mutationFn: (body: any) => api.post('/admin/combat-sim/simulate', body) as Promise<SimResponse>,
    onSuccess: (data: SimResponse) => {
      setResult(data);
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Simulation Error', message: err.message, color: 'red' });
    },
  });

  const handleSimulate = useCallback(() => {
    const body: any = {
      attacker,
      defender,
      config,
      runs,
      type: simType,
    };

    if (simType !== 'attack') {
      body.options = { spiesSent, targetUnitType };
    }

    simulateMutation.mutate(body);
  }, [attacker, defender, config, runs, simType, spiesSent, targetUnitType]);

  const handleResetConfig = useCallback(() => {
    setConfigLoaded(false);
  }, []);

  const handleSaveRun = useCallback(() => {
    if (!result) return;
    const name = `Run ${savedRuns.length + 1} (${simType})`;
    setSavedRuns((prev) => [...prev, { name, summary: result.summary }]);
    notifications.show({ title: 'Saved', message: `Saved as "${name}"`, color: 'green' });
  }, [result, savedRuns.length, simType]);

  const summary = result?.summary;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3} style={{ color: 'var(--ot-gold)' }}>Combat Simulator</Title>
        <Badge size="lg" variant="light" color="orange">Admin Tool</Badge>
      </Group>

      {/* Mission Type Tabs */}
      <Tabs value={simType} onChange={(v) => setSimType(v ?? 'attack')}>
        <Tabs.List>
          <Tabs.Tab value="attack">Attack</Tabs.Tab>
          <Tabs.Tab value="intel">Intel</Tabs.Tab>
          <Tabs.Tab value="assassinate">Assassination</Tabs.Tab>
          <Tabs.Tab value="infiltrate">Infiltration</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Grid gutter="md">
        {/* Left Column: Profiles */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="md">
            <ProfileBuilder
              label="ATTACKER"
              profile={attacker}
              onChange={setAttacker}
              api={api}
              isReady={isReady}
            />
            <ProfileBuilder
              label="DEFENDER"
              profile={defender}
              onChange={setDefender}
              api={api}
              isReady={isReady}
            />

            {/* Spy options */}
            {simType !== 'attack' && (
              <Paper p="md" withBorder style={{ borderColor: 'var(--ot-border)' }}>
                <Text fw={600} size="sm" mb="sm" style={{ color: 'var(--ot-gold)' }}>
                  Spy Options
                </Text>
                <SimpleGrid cols={2} spacing="xs">
                  <NumberInput
                    size="xs"
                    label="Spies Sent"
                    value={spiesSent}
                    onChange={(v) => setSpiesSent(Number(v) || 1)}
                    min={1}
                    max={10}
                  />
                  {simType === 'assassinate' && (
                    <Select
                      size="xs"
                      label="Target Unit Type"
                      value={targetUnitType}
                      onChange={(v) => setTargetUnitType(v ?? 'OFFENSE')}
                      data={[
                        { value: 'OFFENSE', label: 'Offense' },
                        { value: 'DEFENSE', label: 'Defense' },
                        { value: 'SPY', label: 'Spy' },
                        { value: 'SENTRY', label: 'Sentry' },
                        { value: 'CITIZEN', label: 'Citizen' },
                      ]}
                    />
                  )}
                </SimpleGrid>
              </Paper>
            )}
          </Stack>
        </Grid.Col>

        {/* Right Column: Config */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <ConfigSliders config={config} onChange={setConfig} onReset={handleResetConfig} />
        </Grid.Col>
      </Grid>

      {/* Controls */}
      <Paper p="md" withBorder style={{ borderColor: 'var(--ot-border)' }}>
        <Group>
          <SegmentedControl
            size="sm"
            value={String(runs)}
            onChange={(v) => setRuns(parseInt(v, 10))}
            data={[
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
          {result && (
            <Button variant="outline" onClick={handleSaveRun}>
              Save Run
            </Button>
          )}
        </Group>
      </Paper>

      {/* Results */}
      {summary && (
        <Stack gap="md">
          <Text fw={600} size="lg" style={{ color: 'var(--ot-gold)' }}>
            Results ({summary.runs.toLocaleString()} runs)
          </Text>

          {/* Stat Cards */}
          {summary.type === 'attack' && (
            <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="xs">
              <StatCard
                label="Win Rate"
                value={`${Math.round(summary.winRate * 100)}%`}
                color={summary.winRate >= 0.5 ? '#4ecdc4' : '#ff6b6b'}
              />
              <StatCard label="Avg Gold Stolen" value={summary.avgGoldStolen.toLocaleString()} />
              <StatCard label="Avg Atk Casualties" value={summary.avgAttackerCasualties} color="#ff6b6b" />
              <StatCard label="Avg Def Casualties" value={summary.avgDefenderCasualties} color="#c44dff" />
              <StatCard label="Avg Fort Damage" value={summary.avgFortDamage} color="#ffa07a" />
              <StatCard label="Avg XP (Winner)" value={summary.avgAttackerXP} color="#4ecdc4" />
            </SimpleGrid>
          )}

          {(summary.type === 'intel' || summary.type === 'assassinate' || summary.type === 'infiltrate') && (
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="xs">
              <StatCard
                label="Success Rate"
                value={`${Math.round(summary.winRate * 100)}%`}
                color={summary.winRate >= 0.5 ? '#4ecdc4' : '#ff6b6b'}
              />
              {summary.avgRevealPercent !== undefined && (
                <StatCard label="Avg Reveal %" value={`${Math.round(summary.avgRevealPercent)}%`} />
              )}
              {summary.avgUnitsKilled !== undefined && (
                <StatCard label="Avg Units Killed" value={Math.round(summary.avgUnitsKilled)} />
              )}
              {summary.avgFortDamage > 0 && (
                <StatCard label="Avg Fort Damage" value={summary.avgFortDamage} color="#ffa07a" />
              )}
              {summary.avgSpiesLost !== undefined && (
                <StatCard label="Avg Spies Lost" value={Math.round(summary.avgSpiesLost * 10) / 10} color="#ff6b6b" />
              )}
            </SimpleGrid>
          )}

          {/* Charts (attack only) */}
          {summary.type === 'attack' && (
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <HistogramChart
                title="Gold Stolen Distribution"
                data={summary.goldStolenBuckets}
                color="#4ecdc4"
              />
              <HistogramChart
                title="Attacker Casualties Distribution"
                data={summary.attackerCasualtyBuckets}
                color="#ff6b6b"
              />
              <HistogramChart
                title="Defender Casualties Distribution"
                data={summary.defenderCasualtyBuckets}
                color="#c44dff"
              />
              <HistogramChart
                title="Fort Damage Distribution"
                data={summary.fortDamageBuckets}
                color="#ffa07a"
              />
            </SimpleGrid>
          )}

          {/* Infiltration charts */}
          {summary.type === 'infiltrate' && summary.fortDamageBuckets.length > 0 && (
            <HistogramChart
              title="Fort Damage Distribution"
              data={summary.fortDamageBuckets}
              color="#ffa07a"
            />
          )}
        </Stack>
      )}

      {/* Comparison */}
      <ComparisonPanel savedRuns={savedRuns} />

      {savedRuns.length > 0 && (
        <Group>
          <Button
            variant="subtle"
            color="red"
            size="xs"
            onClick={() => setSavedRuns([])}
          >
            Clear All Saved Runs
          </Button>
        </Group>
      )}
    </Stack>
  );
}
