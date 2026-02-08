'use client';

import {
  Container,
  Title,
  Text,
  Badge,
  Stack,
  Group,
  Table,
  Skeleton,
  SimpleGrid,
  Paper,
  Divider,
  Button,
  Progress,
} from '@mantine/core';
import { OTCard, OTSectionTitle } from '@/components/ui';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@/hooks/use-api';
import Link from 'next/link';

interface LineItem {
  name: string;
  quantity: number;
  bonusEach: number;
  total: number;
}

interface BonusLine {
  label: string;
  percent: number;
}

interface DetailedBreakdown {
  statType: string;
  unitLines: LineItem[];
  unitTotal: number;
  itemLines: LineItem[];
  itemTotal: number;
  upgradeLines: LineItem[];
  upgradeTotal: number;
  subtotal: number;
  bonusLines: BonusLine[];
  bonusPercent: number;
  bonusAmount: number;
  total: number;
}

interface CasualtyDetail {
  offenseUnits: number;
  defenseUnits: number;
  citizenUnits: number;
  spyUnits: number;
  sentryUnits: number;
  total: number;
}

interface PlayerMeta {
  race: string;
  playerClass: string;
  level: number;
  fortLevel: number;
  fortHP: number;
  fortMaxHP: number;
}

interface BattleReportData {
  id: number;
  attacker: { id: string; displayName: string; race: string; class: string; level: number | null };
  defender: { id: string; displayName: string; race: string; class: string; level: number | null };
  winner: string;
  type: string;
  timestamp: string | null;
  stats: {
    attackerWins: boolean;
    ratio: number;
    goldStolen: number;
    fortDamage: number;
    attackerCasualties: CasualtyDetail;
    defenderCasualties: CasualtyDetail;
    attackerXP: number;
    defenderXP: number;
    fortShield: number;
    effectiveDefense: number;
    roll?: number;
    attackerOffense?: number;
    defenderDefense?: number;
    attackerBreakdown?: DetailedBreakdown;
    defenderBreakdown?: DetailedBreakdown;
    attackerMeta?: PlayerMeta;
    defenderMeta?: PlayerMeta;
  };
  isAttacker: boolean;
}

const RACE_COLORS: Record<string, string> = {
  HUMAN: 'blue',
  ELF: 'green',
  GOBLIN: 'orange',
  UNDEAD: 'grape',
};

function formatDate(timestamp: string | null) {
  if (!timestamp) return 'Unknown';
  return new Date(timestamp).toLocaleString();
}

function BreakdownTable({ lines, label }: { lines: LineItem[]; label: string }) {
  if (lines.length === 0) return null;
  return (
    <>
      <Text size="sm" fw={600} mt="xs" style={{ color: 'var(--ot-text-dim)' }}>
        {label}
      </Text>
      <Table striped withTableBorder fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th ta="center">Qty</Table.Th>
            <Table.Th ta="right">Each</Table.Th>
            <Table.Th ta="right">Total</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lines.map((line, i) => (
            <Table.Tr key={i}>
              <Table.Td>{line.name}</Table.Td>
              <Table.Td ta="center">{line.quantity.toLocaleString()}</Table.Td>
              <Table.Td ta="right">+{line.bonusEach}</Table.Td>
              <Table.Td ta="right" fw={500}>{line.total.toLocaleString()}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}

function BreakdownPanel({
  title,
  breakdown,
  statLabel,
  color,
}: {
  title: string;
  breakdown: DetailedBreakdown;
  statLabel: string;
  color: string;
}) {
  return (
    <OTCard>
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <OTSectionTitle>{title}</OTSectionTitle>
          <Badge size="lg" variant="filled" color={color}>
            {statLabel}: {breakdown.total.toLocaleString()}
          </Badge>
        </Group>

        <BreakdownTable lines={breakdown.unitLines} label="Units" />
        <BreakdownTable lines={breakdown.itemLines} label="Equipment" />
        <BreakdownTable lines={breakdown.upgradeLines} label="Battle Upgrades" />

        <Divider my="xs" />

        <Text size="sm" fw={600} style={{ color: 'var(--ot-text-dim)' }}>
          Calculation
        </Text>
        <Stack gap={4}>
          <Group justify="space-between">
            <Text size="sm">Units</Text>
            <Text size="sm" fw={500}>{breakdown.unitTotal.toLocaleString()}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Equipment</Text>
            <Text size="sm" fw={500}>{breakdown.itemTotal.toLocaleString()}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Battle Upgrades</Text>
            <Text size="sm" fw={500}>{breakdown.upgradeTotal.toLocaleString()}</Text>
          </Group>
          <Divider variant="dashed" />
          <Group justify="space-between">
            <Text size="sm" fw={600}>Subtotal</Text>
            <Text size="sm" fw={600}>{breakdown.subtotal.toLocaleString()}</Text>
          </Group>

          {breakdown.bonusLines.length > 0 && (
            <>
              <Text size="xs" mt="xs" style={{ color: 'var(--ot-text-dim)' }}>
                Bonus Modifiers:
              </Text>
              {breakdown.bonusLines.map((b, i) => (
                <Group key={i} justify="space-between">
                  <Text size="sm" style={{ color: 'var(--ot-success)' }}>{b.label}</Text>
                  <Text size="sm" style={{ color: 'var(--ot-success)' }}>+{b.percent}%</Text>
                </Group>
              ))}
              <Divider variant="dashed" />
              <Group justify="space-between">
                <Text size="sm">Total Bonus ({breakdown.bonusPercent}%)</Text>
                <Text size="sm" style={{ color: 'var(--ot-success)' }}>
                  +{breakdown.bonusAmount.toLocaleString()}
                </Text>
              </Group>
            </>
          )}

          <Divider />
          <Group justify="space-between">
            <Text fw={700} style={{ color: `var(--ot-gold)` }}>
              Final {breakdown.statType === 'OFFENSE' ? 'Offense' : 'Defense'}
            </Text>
            <Text fw={700} size="lg" style={{ color: `var(--ot-gold)` }}>
              {breakdown.total.toLocaleString()}
            </Text>
          </Group>
        </Stack>
      </Stack>
    </OTCard>
  );
}

function CasualtyRow({ label, count }: { label: string; count: number }) {
  if (count <= 0) return null;
  return (
    <Group justify="space-between">
      <Text size="sm">{label}</Text>
      <Text size="sm" fw={500} style={{ color: 'var(--ot-danger)' }}>
        -{count.toLocaleString()}
      </Text>
    </Group>
  );
}

export default function BattleReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { api, isReady } = useApi();

  const { data: report, isLoading } = useQuery<BattleReportData>({
    queryKey: ['battle', 'report', params.id],
    queryFn: () => api.get(`/battle/history/${params.id}`),
    enabled: isReady && !!params.id,
  });

  if (isLoading || !report) {
    return (
      <Container size="lg">
        <Stack gap="md">
          <Skeleton height={80} />
          <Skeleton height={200} />
          <Skeleton height={400} />
        </Stack>
      </Container>
    );
  }

  const { stats } = report;
  const hasBreakdown = !!stats.attackerBreakdown && !!stats.defenderBreakdown;
  const attackerWins = stats.attackerWins;

  return (
    <Container size="lg">
      <Stack gap="md">
        {/* ── Header ──────────────────────────────────────── */}
        <Group justify="space-between" align="center">
          <Title order={2}>Battle Report</Title>
          <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
            {formatDate(report.timestamp)}
          </Text>
        </Group>

        {/* ── Combat Overview ─────────────────────────────── */}
        <Group justify="center" align="center" gap="lg" wrap="wrap">
          <OTCard style={{ flex: 1, minWidth: 200 }}>
            <Stack gap="xs" align="center">
              <Text size="xs" tt="uppercase" style={{ color: 'var(--ot-text-dim)' }}>
                Attacker
              </Text>
              <Text
                component={Link}
                href={`/profile/${report.attacker.id}`}
                fw={700}
                size="lg"
                style={{ color: 'var(--ot-gold)', textDecoration: 'none' }}
              >
                {report.attacker.displayName}
              </Text>
              <Group gap={4}>
                <Badge variant="light" size="xs" color={RACE_COLORS[report.attacker.race] ?? 'gray'}>
                  {report.attacker.race}
                </Badge>
                <Badge variant="light" size="xs" color="gray">
                  {report.attacker.class}
                </Badge>
                {report.attacker.level != null && (
                  <Badge variant="light" size="xs" color="teal">
                    Lv {report.attacker.level}
                  </Badge>
                )}
              </Group>
              {stats.attackerOffense != null && (
                <Badge size="lg" variant="filled" color="red" mt="xs">
                  Offense: {stats.attackerOffense.toLocaleString()}
                </Badge>
              )}
            </Stack>
          </OTCard>

          <Text fw={700} size="xl" style={{ color: 'var(--ot-text-dim)' }}>
            VS
          </Text>

          <OTCard style={{ flex: 1, minWidth: 200 }}>
            <Stack gap="xs" align="center">
              <Text size="xs" tt="uppercase" style={{ color: 'var(--ot-text-dim)' }}>
                Defender
              </Text>
              <Text
                component={Link}
                href={`/profile/${report.defender.id}`}
                fw={700}
                size="lg"
                style={{ color: 'var(--ot-gold)', textDecoration: 'none' }}
              >
                {report.defender.displayName}
              </Text>
              <Group gap={4}>
                <Badge variant="light" size="xs" color={RACE_COLORS[report.defender.race] ?? 'gray'}>
                  {report.defender.race}
                </Badge>
                <Badge variant="light" size="xs" color="gray">
                  {report.defender.class}
                </Badge>
                {report.defender.level != null && (
                  <Badge variant="light" size="xs" color="teal">
                    Lv {report.defender.level}
                  </Badge>
                )}
              </Group>
              {stats.defenderDefense != null && (
                <Badge size="lg" variant="filled" color="blue" mt="xs">
                  Defense: {stats.defenderDefense.toLocaleString()}
                </Badge>
              )}
            </Stack>
          </OTCard>
        </Group>

        {/* ── Quick Stats ─────────────────────────────────── */}
        <OTCard>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
            <Paper p="sm" withBorder ta="center">
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Result</Text>
              <Badge
                variant="filled"
                size="lg"
                mt={4}
                color={attackerWins ? 'green' : 'red'}
              >
                {attackerWins ? 'Attacker Wins' : 'Defender Wins'}
              </Badge>
            </Paper>
            <Paper p="sm" withBorder ta="center">
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Combat Ratio</Text>
              <Text fw={700} size="lg" mt={4}>{stats.ratio}x</Text>
            </Paper>
            {stats.roll != null && (
              <Paper p="sm" withBorder ta="center">
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Strength Roll</Text>
                <Text fw={700} size="lg" mt={4}>{stats.roll}x</Text>
              </Paper>
            )}
            <Paper p="sm" withBorder ta="center">
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Fort Shield</Text>
              <Text fw={700} size="lg" mt={4}>+{Math.round(stats.fortShield * 100)}%</Text>
            </Paper>
          </SimpleGrid>
        </OTCard>

        {/* ── Battle Results ──────────────────────────────── */}
        <OTCard>
          <OTSectionTitle>Battle Results</OTSectionTitle>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="sm">
            <Paper p="md" withBorder ta="center">
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Gold Stolen</Text>
              <Text fw={700} size="xl" style={{ color: attackerWins ? 'var(--ot-success)' : 'var(--ot-text-dim)' }}>
                {Number(stats.goldStolen).toLocaleString()}
              </Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>Fort Damage</Text>
              <Text fw={700} size="xl" style={{ color: stats.fortDamage > 0 ? 'var(--ot-warning)' : 'var(--ot-text-dim)' }}>
                {stats.fortDamage}
              </Text>
            </Paper>
            <Paper p="md" withBorder ta="center">
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>XP Gained</Text>
              <Group gap={4} justify="center">
                <Text fw={700} size="xl" style={{ color: 'var(--ot-gold)' }}>
                  {report.isAttacker ? stats.attackerXP : stats.defenderXP}
                </Text>
              </Group>
            </Paper>
          </SimpleGrid>
        </OTCard>

        {/* ── Detailed Breakdown Panels ───────────────────── */}
        {hasBreakdown ? (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <BreakdownPanel
              title="Attacker's Offense"
              breakdown={stats.attackerBreakdown!}
              statLabel="Offense"
              color="red"
            />
            <BreakdownPanel
              title="Defender's Defense"
              breakdown={stats.defenderBreakdown!}
              statLabel="Defense"
              color="blue"
            />
          </SimpleGrid>
        ) : (
          <OTCard>
            <Stack gap="sm">
              <OTSectionTitle>Combat Details</OTSectionTitle>
              <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                Detailed breakdown is not available for this battle log (recorded before the breakdown feature).
              </Text>
              <SimpleGrid cols={2} spacing="xs">
                <Group justify="space-between">
                  <Text size="sm">Effective Defense</Text>
                  <Text size="sm" fw={500}>{Math.round(stats.effectiveDefense).toLocaleString()}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Fort Shield</Text>
                  <Text size="sm" fw={500}>+{Math.round(stats.fortShield * 100)}%</Text>
                </Group>
              </SimpleGrid>
            </Stack>
          </OTCard>
        )}

        {/* ── Combat Resolution ───────────────────────────── */}
        {hasBreakdown && stats.roll != null && (
          <OTCard>
            <OTSectionTitle>Combat Resolution</OTSectionTitle>
            <Stack gap="sm" mt="sm">
              <Group justify="space-between">
                <Text size="sm">Attacker Offense</Text>
                <Text size="sm" fw={500}>{stats.attackerOffense?.toLocaleString()}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Strength Roll</Text>
                <Text size="sm" fw={500}>{stats.roll}x</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Effective Offense</Text>
                <Text size="sm" fw={600}>
                  {Math.round((stats.attackerOffense ?? 0) * stats.roll).toLocaleString()}
                </Text>
              </Group>
              <Divider variant="dashed" />
              <Group justify="space-between">
                <Text size="sm">Defender Defense</Text>
                <Text size="sm" fw={500}>{stats.defenderDefense?.toLocaleString()}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Fort Shield (+{Math.round(stats.fortShield * 100)}%)</Text>
                <Text size="sm" fw={500} style={{ color: 'var(--ot-success)' }}>
                  +{Math.round((stats.defenderDefense ?? 0) * stats.fortShield).toLocaleString()}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Effective Defense</Text>
                <Text size="sm" fw={600}>{Math.round(stats.effectiveDefense).toLocaleString()}</Text>
              </Group>
              <Divider />
              <Group justify="space-between">
                <Text fw={700}>Combat Ratio</Text>
                <Text fw={700} size="lg" style={{ color: attackerWins ? 'var(--ot-success)' : 'var(--ot-danger)' }}>
                  {stats.ratio}x {attackerWins ? '(Attacker Wins)' : '(Defender Wins)'}
                </Text>
              </Group>
              <Progress
                value={Math.min(stats.ratio * 50, 100)}
                color={attackerWins ? 'green' : 'red'}
                size="lg"
                mt="xs"
              />
            </Stack>
          </OTCard>
        )}

        {/* ── Casualties ──────────────────────────────────── */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <OTCard>
            <OTSectionTitle>Attacker Casualties</OTSectionTitle>
            <Stack gap="xs" mt="sm">
              {stats.attackerCasualties.total === 0 ? (
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>No casualties</Text>
              ) : (
                <>
                  <CasualtyRow label="Offense Units" count={stats.attackerCasualties.offenseUnits} />
                  <CasualtyRow label="Defense Units" count={stats.attackerCasualties.defenseUnits} />
                  <CasualtyRow label="Spy Units" count={stats.attackerCasualties.spyUnits} />
                  <CasualtyRow label="Sentry Units" count={stats.attackerCasualties.sentryUnits} />
                  <CasualtyRow label="Citizens" count={stats.attackerCasualties.citizenUnits} />
                  <Divider variant="dashed" />
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>Total</Text>
                    <Text size="sm" fw={700} style={{ color: 'var(--ot-danger)' }}>
                      -{stats.attackerCasualties.total.toLocaleString()}
                    </Text>
                  </Group>
                </>
              )}
            </Stack>
          </OTCard>

          <OTCard>
            <OTSectionTitle>Defender Casualties</OTSectionTitle>
            <Stack gap="xs" mt="sm">
              {stats.defenderCasualties.total === 0 ? (
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>No casualties</Text>
              ) : (
                <>
                  <CasualtyRow label="Defense Units" count={stats.defenderCasualties.defenseUnits} />
                  <CasualtyRow label="Offense Units" count={stats.defenderCasualties.offenseUnits} />
                  <CasualtyRow label="Spy Units" count={stats.defenderCasualties.spyUnits} />
                  <CasualtyRow label="Sentry Units" count={stats.defenderCasualties.sentryUnits} />
                  <CasualtyRow label="Citizens" count={stats.defenderCasualties.citizenUnits} />
                  <Divider variant="dashed" />
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>Total</Text>
                    <Text size="sm" fw={700} style={{ color: 'var(--ot-danger)' }}>
                      -{stats.defenderCasualties.total.toLocaleString()}
                    </Text>
                  </Group>
                </>
              )}
            </Stack>
          </OTCard>
        </SimpleGrid>

        {/* ── Back Link ───────────────────────────────────── */}
        <Group justify="center">
          <Button
            variant="light"
            onClick={() => router.push('/battle/history')}
          >
            Back to Battle History
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
