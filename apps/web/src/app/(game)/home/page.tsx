'use client';

import {
  Container,
  SimpleGrid,
  Group,
  Stack,
  Title,
  Text,
  Progress,
  Badge,
  Skeleton,
  Tooltip,
  Anchor,
  Button,
  ThemeIcon,
} from '@mantine/core';
import { OTCard } from '@/components/ui';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { useRaceTheme } from '@/context/race-theme';
import Link from 'next/link';
import {
  computeArmoryValue,
  getFortificationByLevel,
  getLevelForXP,
  getXPForLevel,
  getXPToNextLevel,
  toLocale,
} from '@openthrone/game-logic';

// ─── Types ──────────────────────────────────────────────────────────────

interface PlayerUnit {
  unitType: string;
  level: number;
  quantity: number;
}

interface PlayerItem {
  itemType: string;
  usage: string;
  level: number;
  quantity: number;
}

interface PlayerData {
  id: string;
  displayName: string;
  race: string;
  class: string;
  economy: {
    gold: string;
    goldInBank: string;
    attackTurns: number;
    houseLevel: number;
    economyLevel: number;
  };
  stats: {
    experience: number;
    rank: number;
    offense: number;
    defense: number;
    spy: number;
    sentry: number;
  };
  fortification: {
    fortLevel: number;
    hitpoints: number;
  };
  units: PlayerUnit[];
  items: PlayerItem[];
}

interface StatBreakdown {
  units: number;
  items: number;
  battleUpgrades: number;
  bonusPercent: number;
  bonusAmount: number;
  total: number;
}

interface GoldPerTurnBreakdown {
  fortGold: number;
  workerGold: number;
  incomeBonus: number;
  incomeBonusPercent: number;
  total: number;
}

interface CitizensPerDayBreakdown {
  houseBase: number;
  recruitBonus: number;
  recruitBonusPercent: number;
  total: number;
}

interface BonusLine {
  label: string;
  percent: number;
}

interface LineItem {
  name: string;
  quantity: number;
  bonusEach: number;
  total: number;
}

interface DetailedStatBreakdown {
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

interface BonusPoint {
  bonusType: string;
  level: number;
}

interface RankPositions {
  overall: number;
  offense: number;
  defense: number;
  spy: number;
  sentry: number;
  netWorth: number;
}

interface BreakdownData {
  offense: StatBreakdown;
  defense: StatBreakdown;
  spy: StatBreakdown;
  sentry: StatBreakdown;
  detailed?: {
    offense: DetailedStatBreakdown;
    defense: DetailedStatBreakdown;
    spy: DetailedStatBreakdown;
    sentry: DetailedStatBreakdown;
  };
  goldPerTurn: GoldPerTurnBreakdown;
  citizensPerDay: CitizensPerDayBreakdown;
  bonusPoints?: BonusPoint[];
  availablePoints?: number;
  ranks?: RankPositions;
}

interface BattleLogEntry {
  id: number;
  attacker: { id: string; displayName: string; race: string };
  defender: { id: string; displayName: string; race: string };
  winner: string;
  type: string;
  goldStolen: string;
  timestamp: string;
  isAttacker: boolean;
}

interface BattleHistoryResponse {
  data: BattleLogEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface MailItem {
  id: number;
  subject: string;
  mailType: string;
  sender: { id: string; displayName: string } | null;
  isRead: boolean;
  createdAt: string;
}

interface MailResponse {
  items: MailItem[];
  total: number;
  page: number;
  unreadCount: number;
}

// ─── Tooltip Content ────────────────────────────────────────────────────

function StatTooltipContent({ label, bd, detailed }: { label: string; bd: StatBreakdown; detailed?: DetailedStatBreakdown }) {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={700}>{label} Breakdown</Text>
      <Text size="xs">Units: {toLocale(bd.units)}</Text>
      <Text size="xs">Items: {toLocale(bd.items)}</Text>
      <Text size="xs">Battle Upgrades: {toLocale(bd.battleUpgrades)}</Text>
      {detailed?.bonusLines && detailed.bonusLines.length > 0 ? (
        <>
          <Text size="xs" fw={600} mt={2}>Bonus Sources (+{bd.bonusPercent}%):</Text>
          {detailed.bonusLines.map((bl, i) => (
            <Text size="xs" key={i} pl={8}>
              {bl.label}: +{bl.percent}%
            </Text>
          ))}
          <Text size="xs">= {toLocale(bd.bonusAmount)} bonus</Text>
        </>
      ) : (
        <Text size="xs">Bonus: +{bd.bonusPercent}% ({toLocale(bd.bonusAmount)})</Text>
      )}
      <Text size="xs" fw={600}>Total: {toLocale(bd.total)}</Text>
    </Stack>
  );
}

function GoldTooltipContent({ bd }: { bd: GoldPerTurnBreakdown }) {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={700}>Gold Per Turn Breakdown</Text>
      <Text size="xs">Fort Income: {toLocale(bd.fortGold)}</Text>
      <Text size="xs">Workers: {toLocale(bd.workerGold)}</Text>
      {bd.incomeBonusPercent > 0 && (
        <Text size="xs">Income Bonus: +{bd.incomeBonusPercent}% ({toLocale(bd.incomeBonus)})</Text>
      )}
      <Text size="xs" fw={600}>Total: {toLocale(bd.total)}</Text>
    </Stack>
  );
}

function CitizensTooltipContent({ bd }: { bd: CitizensPerDayBreakdown }) {
  return (
    <Stack gap={2}>
      <Text size="xs" fw={700}>Citizens Per Day Breakdown</Text>
      <Text size="xs">Housing: {toLocale(bd.houseBase)}</Text>
      {bd.recruitBonusPercent > 0 && (
        <Text size="xs">Recruit Bonus: +{bd.recruitBonusPercent}% ({toLocale(bd.recruitBonus)})</Text>
      )}
      <Text size="xs" fw={600}>Total: {toLocale(bd.total)}</Text>
    </Stack>
  );
}

// ─── Countdown Hook ─────────────────────────────────────────────────────

function useCountdowns() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Next turn tick: every 30 minutes on the clock (XX:00 and XX:30)
  const msIn30Min = 30 * 60 * 1000;
  const nextTurnMs = Math.ceil(now.getTime() / msIn30Min) * msIn30Min - now.getTime();
  const nextTurnMin = Math.floor(nextTurnMs / 60000);
  const nextTurnSec = Math.floor((nextTurnMs % 60000) / 1000);

  // Daily reset: midnight UTC
  const tomorrowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dailyResetMs = tomorrowUTC.getTime() - now.getTime();
  const dailyResetH = Math.floor(dailyResetMs / 3600000);
  const dailyResetM = Math.floor((dailyResetMs % 3600000) / 60000);
  const dailyResetS = Math.floor((dailyResetMs % 60000) / 1000);

  return {
    nextTurn: `${nextTurnMin}:${String(nextTurnSec).padStart(2, '0')}`,
    dailyReset: `${dailyResetH}h ${String(dailyResetM).padStart(2, '0')}m ${String(dailyResetS).padStart(2, '0')}s`,
  };
}

// ─── Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { api, isReady } = useApi();
  const { colorName } = useRaceTheme();
  const countdowns = useCountdowns();

  const { data: player, isLoading } = useQuery<PlayerData>({
    queryKey: ['player', 'me'],
    queryFn: () => api.get('/player/me'),
    enabled: isReady,
  });

  const { data: breakdown } = useQuery<BreakdownData>({
    queryKey: ['player', 'stat-breakdown'],
    queryFn: () => api.get('/player/me/stat-breakdown'),
    enabled: isReady,
  });

  const { data: battles } = useQuery<BattleHistoryResponse>({
    queryKey: ['battle', 'history', 'dashboard'],
    queryFn: () => api.get('/battle/history?limit=5'),
    enabled: isReady,
  });

  const { data: mail } = useQuery<MailResponse>({
    queryKey: ['mail', 'dashboard'],
    queryFn: () => api.get('/mail?limit=5'),
    enabled: isReady,
  });

  if (isLoading || !player) {
    return (
      <Container>
        <Stack gap="md">
          <Skeleton height={40} width={300} />
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} height={180} radius="sm" />
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    );
  }

  const experience = player.stats?.experience ?? 0;
  const gold = Number(player.economy?.gold ?? 0);
  const goldInBank = Number(player.economy?.goldInBank ?? 0);
  const attackTurns = player.economy?.attackTurns ?? 0;
  const fortLevel = player.fortification?.fortLevel ?? 1;
  const fortHitpoints = player.fortification?.hitpoints ?? 0;
  const rank = player.stats?.rank ?? 0;

  const level = getLevelForXP(experience);
  const currentLevelXP = getXPForLevel(level);
  const nextLevelXP = getXPForLevel(level + 1) || currentLevelXP;
  const xpToNext = Math.max(0, nextLevelXP - experience);
  const xpProgress =
    nextLevelXP > currentLevelXP
      ? ((experience - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
      : 100;

  const fort = getFortificationByLevel(fortLevel);
  const fortName = fort?.name ?? 'Unknown';
  const fortMaxHp = fort?.hitpoints ?? 1;
  const fortHpPercent = Math.min(100, (fortHitpoints / fortMaxHp) * 100);

  const totalUnits = player.units?.reduce((sum, u) => sum + u.quantity, 0) ?? 0;

  const armoryValue = computeArmoryValue(player.items ?? []);

  const offense = breakdown?.offense.total ?? player.stats?.offense ?? 0;
  const defense = breakdown?.defense.total ?? player.stats?.defense ?? 0;
  const spy = breakdown?.spy.total ?? player.stats?.spy ?? 0;
  const sentry = breakdown?.sentry.total ?? player.stats?.sentry ?? 0;
  const goldPerTurn = breakdown?.goldPerTurn.total ?? fort?.goldPerTurn ?? 0;
  const citizensPerDay = breakdown?.citizensPerDay.total ?? 0;

  const unreadCount = mail?.unreadCount ?? 0;

  return (
    <Container size="xl">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Title order={2}>{player.displayName}&apos;s Kingdom</Title>
          <Group gap="xs">
            <Badge variant="light" color={colorName}>
              {player.race}
            </Badge>
            <Badge variant="light" color="ot">
              {player.class}
            </Badge>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {/* Quick Actions */}
          <OTCard>
            <Stack gap="sm">
              <Title order={4}>Quick Actions</Title>
              <SimpleGrid cols={2} spacing="xs">
                <Button
                  component={Link}
                  href="/battle/players"
                  variant="light"
                  color="red"
                  leftSection={'\u2694\uFE0F'}
                  size="sm"
                  fullWidth
                >
                  Attack
                </Button>
                <Button
                  component={Link}
                  href="/battle/training"
                  variant="light"
                  color="blue"
                  leftSection={'\uD83C\uDFCB\uFE0F'}
                  size="sm"
                  fullWidth
                >
                  Train
                </Button>
                <Button
                  component={Link}
                  href="/structures/bank"
                  variant="light"
                  color="green"
                  leftSection={'\uD83C\uDFE6'}
                  size="sm"
                  fullWidth
                >
                  Bank
                </Button>
                <Button
                  component={Link}
                  href="/structures/armory"
                  variant="light"
                  color="grape"
                  leftSection={'\uD83D\uDEE1\uFE0F'}
                  size="sm"
                  fullWidth
                >
                  Armory
                </Button>
              </SimpleGrid>
              <Group justify="space-between" mt={4}>
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                  Attack Turns
                </Text>
                <Badge
                  size="sm"
                  variant="light"
                  color={attackTurns > 0 ? 'green' : 'red'}
                >
                  {toLocale(attackTurns)} remaining
                </Badge>
              </Group>
              <Group justify="space-between" mt={2}>
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                  Next Turn
                </Text>
                <Text size="xs" fw={600} style={{ color: 'var(--ot-gold)', fontVariantNumeric: 'tabular-nums' }}>
                  {countdowns.nextTurn}
                </Text>
              </Group>
              <Group justify="space-between" mt={2}>
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                  Daily Reset
                </Text>
                <Text size="xs" fw={600} style={{ color: 'var(--ot-gold)', fontVariantNumeric: 'tabular-nums' }}>
                  {countdowns.dailyReset}
                </Text>
              </Group>
            </Stack>
          </OTCard>

          {/* Kingdom Overview */}
          <OTCard>
            <Stack gap="sm">
              <Title order={4}>Kingdom Overview</Title>
              <Group justify="space-between">
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  Level
                </Text>
                <Text fw={600} className="ot-stat-value">{level}</Text>
              </Group>
              <div>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                    XP Progress
                  </Text>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                    {toLocale(experience)} / {toLocale(nextLevelXP || experience)}
                  </Text>
                </Group>
                <Progress value={xpProgress} size="lg" color={colorName} radius="sm" />
                <Text size="xs" style={{ color: 'var(--ot-text-dim)' }} mt={4}>
                  {xpToNext > 0 ? `${toLocale(xpToNext)} XP to next level (${Math.round(xpProgress)}%)` : 'Max level reached!'}
                </Text>
              </div>
              <Group justify="space-between">
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  Total Units
                </Text>
                <Text fw={600} className="ot-stat-value">{toLocale(totalUnits)}</Text>
              </Group>
            </Stack>
          </OTCard>

          {/* Rankings */}
          <OTCard>
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Tooltip
                  label={
                    <Stack gap={2}>
                      <Text size="xs" fw={700}>Overall Rank Formula</Text>
                      <Text size="xs">Offense: 1.0x weight</Text>
                      <Text size="xs">Defense: 1.0x weight</Text>
                      <Text size="xs">Spy: 1.25x weight</Text>
                      <Text size="xs">Sentry: 1.25x weight</Text>
                      <Text size="xs">Fort Level: exponential bonus</Text>
                      <Text size="xs">XP: small bonus</Text>
                      <Text size="xs">Net Worth: log scale bonus</Text>
                    </Stack>
                  }
                  multiline
                  w={220}
                >
                  <Title order={4} style={{ cursor: 'help', textDecoration: 'underline', textDecorationStyle: 'dotted' as const }}>
                    Rankings
                  </Title>
                </Tooltip>
                <Anchor component={Link} href="/world/rankings" size="xs">
                  Leaderboard
                </Anchor>
              </Group>
              {([
                { label: 'Overall', value: breakdown?.ranks?.overall ?? rank },
                { label: 'Offense', value: breakdown?.ranks?.offense },
                { label: 'Defense', value: breakdown?.ranks?.defense },
                { label: 'Spy', value: breakdown?.ranks?.spy },
                { label: 'Sentry', value: breakdown?.ranks?.sentry },
                { label: 'Net Worth', value: breakdown?.ranks?.netWorth },
              ] as const).map((item) => (
                <Group key={item.label} justify="space-between">
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    {item.label}
                  </Text>
                  <Text size="sm" fw={600} style={{ color: 'var(--ot-gold)' }}>
                    {item.value ? `#${item.value}` : '--'}
                  </Text>
                </Group>
              ))}
            </Stack>
          </OTCard>

          {/* Economy */}
          <OTCard>
            <Stack gap="sm">
              <Title order={4}>Economy</Title>
              <Group justify="space-between">
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  Gold
                </Text>
                <Text fw={600} className="ot-stat-value">{toLocale(gold)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  Gold in Bank
                </Text>
                <Text fw={600} className="ot-stat-value">{toLocale(goldInBank)}</Text>
              </Group>
              <Tooltip
                label={breakdown?.goldPerTurn ? <GoldTooltipContent bd={breakdown.goldPerTurn} /> : 'Loading...'}
                multiline
                w={220}
              >
                <Group justify="space-between" style={{ cursor: 'help' }}>
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)', textDecoration: 'underline', textDecorationStyle: 'dotted' as const }}>
                    Gold Per Turn
                  </Text>
                  <Text fw={600} style={{ color: 'var(--ot-success)' }}>
                    +{toLocale(goldPerTurn)}
                  </Text>
                </Group>
              </Tooltip>
              <Tooltip
                label={breakdown?.citizensPerDay ? <CitizensTooltipContent bd={breakdown.citizensPerDay} /> : 'Loading...'}
                multiline
                w={220}
              >
                <Group justify="space-between" style={{ cursor: 'help' }}>
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)', textDecoration: 'underline', textDecorationStyle: 'dotted' as const }}>
                    Citizens Per Day
                  </Text>
                  <Text fw={600} style={{ color: 'var(--ot-race-primary)' }}>
                    +{toLocale(citizensPerDay)}
                  </Text>
                </Group>
              </Tooltip>
              <Tooltip
                label={
                  <Stack gap={2}>
                    <Text size="xs" fw={700}>Net Worth Breakdown</Text>
                    <Text size="xs">Gold on Hand: {toLocale(gold)}</Text>
                    <Text size="xs">Gold in Bank: {toLocale(goldInBank)}</Text>
                    {armoryValue > 0 && (
                      <Text size="xs">Armory Value: {toLocale(armoryValue)}</Text>
                    )}
                    <Text size="xs" fw={600}>Total: {toLocale(gold + goldInBank + armoryValue)}</Text>
                  </Stack>
                }
                multiline
                w={220}
              >
                <Group justify="space-between" style={{ cursor: 'help' }}>
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)', textDecoration: 'underline', textDecorationStyle: 'dotted' as const }}>
                    Net Worth
                  </Text>
                  <Text fw={600} className="ot-stat-value">
                    {toLocale(gold + goldInBank + armoryValue)}
                  </Text>
                </Group>
              </Tooltip>
            </Stack>
          </OTCard>

          {/* Military Summary */}
          <OTCard>
            <Stack gap="sm">
              <Title order={4}>Military Summary</Title>
              {(['offense', 'defense', 'spy', 'sentry'] as const).map((stat) => {
                const value = { offense, defense, spy, sentry }[stat];
                const bd = breakdown?.[stat];
                const det = breakdown?.detailed?.[stat];
                const label = stat.charAt(0).toUpperCase() + stat.slice(1);
                return (
                  <Tooltip
                    key={stat}
                    label={bd ? <StatTooltipContent label={label} bd={bd} detailed={det} /> : 'Loading...'}
                    multiline
                    w={250}
                  >
                    <Group justify="space-between" style={{ cursor: 'help' }}>
                      <Text size="sm" style={{ color: 'var(--ot-text-dim)', textDecoration: 'underline', textDecorationStyle: 'dotted' as const }}>
                        {label}
                      </Text>
                      <Text fw={600} className="ot-stat-value">{toLocale(value)}</Text>
                    </Group>
                  </Tooltip>
                );
              })}
            </Stack>
          </OTCard>

          {/* Recent Battles */}
          <OTCard>
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Title order={4}>Recent Battles</Title>
                <Anchor component={Link} href="/battle/history" size="xs">
                  View all
                </Anchor>
              </Group>
              {battles && battles.data.length > 0 ? (
                battles.data.slice(0, 5).map((battle) => {
                  const won = battle.isAttacker
                    ? battle.winner === battle.attacker.id
                    : battle.winner === battle.defender.id;
                  const opponent = battle.isAttacker ? battle.defender : battle.attacker;
                  const action = battle.isAttacker ? 'Attacked' : 'Defended vs';
                  return (
                    <Anchor
                      key={battle.id}
                      component={Link}
                      href={`/battle/report/${battle.id}`}
                      underline="never"
                      style={{ display: 'block' }}
                    >
                      <Group justify="space-between" gap="xs">
                        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                          <Badge
                            size="xs"
                            variant="light"
                            color={won ? 'green' : 'red'}
                            style={{ flexShrink: 0 }}
                          >
                            {won ? 'W' : 'L'}
                          </Badge>
                          <Text size="xs" truncate style={{ color: 'var(--ot-text-dim)' }}>
                            {action}{' '}
                            <Text span fw={600} style={{ color: 'var(--ot-gold)' }}>
                              {opponent.displayName}
                            </Text>
                          </Text>
                        </Group>
                        {battle.isAttacker && Number(battle.goldStolen) > 0 && (
                          <Text size="xs" style={{ color: 'var(--ot-success)', flexShrink: 0 }}>
                            +{toLocale(Number(battle.goldStolen))}g
                          </Text>
                        )}
                      </Group>
                    </Anchor>
                  );
                })
              ) : (
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  No battles yet. Find someone to attack!
                </Text>
              )}
            </Stack>
          </OTCard>

          {/* Messages */}
          <OTCard>
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <Title order={4}>Messages</Title>
                  {unreadCount > 0 && (
                    <Badge size="sm" color="red" variant="filled" circle>
                      {unreadCount}
                    </Badge>
                  )}
                </Group>
                <Anchor component={Link} href="/messaging" size="xs">
                  View all
                </Anchor>
              </Group>
              {mail && mail.items.length > 0 ? (
                mail.items.slice(0, 5).map((item) => (
                  <Group key={item.id} justify="space-between" gap="xs">
                    <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                      {!item.isRead && (
                        <ThemeIcon size={8} radius="xl" color="blue" style={{ flexShrink: 0 }}>
                          <span />
                        </ThemeIcon>
                      )}
                      <Text
                        size="xs"
                        truncate
                        fw={item.isRead ? 400 : 600}
                        style={{ color: item.isRead ? 'var(--ot-text-dim)' : undefined }}
                      >
                        {item.subject}
                      </Text>
                    </Group>
                    <Text size="xs" style={{ color: 'var(--ot-text-dim)', flexShrink: 0 }}>
                      {item.sender?.displayName ?? 'System'}
                    </Text>
                  </Group>
                ))
              ) : (
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  No messages yet.
                </Text>
              )}
            </Stack>
          </OTCard>

          {/* Fort */}
          <OTCard>
            <Stack gap="sm">
              <Title order={4}>Fortification</Title>
              <Group justify="space-between">
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  Fort
                </Text>
                <Text fw={600} className="ot-stat-value">
                  {fortName} (Level {fortLevel})
                </Text>
              </Group>
              <div>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                    Hitpoints
                  </Text>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                    {toLocale(fortHitpoints)} / {toLocale(fortMaxHp)}
                  </Text>
                </Group>
                <Progress
                  value={fortHpPercent}
                  size="sm"
                  color={fortHpPercent > 50 ? 'green' : fortHpPercent > 25 ? 'yellow' : 'red'}
                />
              </div>
            </Stack>
          </OTCard>

          {/* Proficiency Points */}
          <OTCard>
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Title order={4}>Proficiencies</Title>
                {(breakdown?.availablePoints ?? 0) > 0 && (
                  <Badge size="sm" color="green" variant="light">
                    {breakdown?.availablePoints} to spend
                  </Badge>
                )}
              </Group>
              {breakdown?.bonusPoints && breakdown.bonusPoints.length > 0 ? (
                breakdown.bonusPoints
                  .filter((bp) => bp.level > 0)
                  .map((bp) => (
                    <Group key={bp.bonusType} justify="space-between">
                      <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                        {bp.bonusType.charAt(0) + bp.bonusType.slice(1).toLowerCase()}
                      </Text>
                      <Text size="sm" fw={600} className="ot-stat-value">
                        Lv {bp.level}
                      </Text>
                    </Group>
                  ))
              ) : (
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                  No points allocated yet.
                </Text>
              )}
              {(breakdown?.availablePoints ?? 0) > 0 && (
                <Anchor component={Link} href="/battle/proficiencies" size="sm">
                  Allocate points
                </Anchor>
              )}
            </Stack>
          </OTCard>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
