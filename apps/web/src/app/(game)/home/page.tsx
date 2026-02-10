'use client';

import {
  Container,
  SimpleGrid,
  Grid,
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
import { OTCard, StatRow, TooltipStat, ActivityFeedItem } from '@/components/ui';
import type { ActivityItem } from '@/components/ui';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { useRaceTheme } from '@/context/race-theme';
import { useCountdowns } from '@/hooks/use-countdowns';
import { getRecommendedAction } from '@/lib/recommended-action';
import Link from 'next/link';
import {
  computeArmoryValue,
  getFortificationByLevel,
  getLevelForXP,
  getXPForLevel,
  toLocale,
} from '@openthrone/game-logic';
import {
  IconCoins,
  IconSwords,
  IconHistory,
  IconBulb,
  IconTrophy,
  IconStar,
  IconWall,
  IconRocket,
  IconUsers,
  IconBuildingBank,
  IconTarget,
} from '@tabler/icons-react';

// ─── Types ──────────────────────────────────────────────────────────────

type ActivityScope = 'my' | 'alliance' | 'server';

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

interface PlayerAlliance {
  id: number;
  name: string;
  role: string;
}

interface PlayerData {
  id: string;
  displayName: string;
  race: string;
  class: string;
  alliances?: PlayerAlliance[];
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
  availablePoints?: number;
  availableUpgrades?: number;
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
  const goldPerDay = bd.total * 48; // 48 turns per day (every 30 min)
  return (
    <Stack gap={2}>
      <Text size="xs" fw={700}>Gold Per Turn Breakdown</Text>
      <Text size="xs">Fort Income: {toLocale(bd.fortGold)}</Text>
      <Text size="xs">Workers: {toLocale(bd.workerGold)}</Text>
      {bd.incomeBonusPercent > 0 && (
        <Text size="xs">Income Bonus: +{bd.incomeBonusPercent}% ({toLocale(bd.incomeBonus)})</Text>
      )}
      <Text size="xs" fw={600}>Per Turn: {toLocale(bd.total)}</Text>
      <Text size="xs" fw={600} style={{ color: 'var(--ot-success)' }}>
        Per Day: ~{toLocale(goldPerDay)}
      </Text>
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

// ─── Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { api, isReady } = useApi();
  const { colorName } = useRaceTheme();
  const countdowns = useCountdowns();
  const [activityScope, setActivityScope] = useState<ActivityScope>('my');

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

  const firstAllianceId = player?.alliances?.[0]?.id;

  const { data: myFeed } = useQuery<{ data: ActivityItem[] }>({
    queryKey: ['activity', 'me', 'dashboard'],
    queryFn: () => api.get('/activity/me?limit=5'),
    enabled: isReady && activityScope === 'my',
  });

  const { data: allianceFeed } = useQuery<{ data: ActivityItem[] }>({
    queryKey: ['activity', 'alliance', firstAllianceId, 'dashboard'],
    queryFn: () => api.get(`/activity/alliance/${firstAllianceId}?limit=5`),
    enabled: isReady && activityScope === 'alliance' && !!firstAllianceId,
  });

  const { data: serverFeed } = useQuery<{ data: ActivityItem[] }>({
    queryKey: ['activity', 'server', 'dashboard'],
    queryFn: () => api.get('/activity/server?limit=5'),
    enabled: isReady && activityScope === 'server',
  });

  const activeFeed =
    activityScope === 'alliance' ? allianceFeed
    : activityScope === 'server' ? serverFeed
    : myFeed;

  const { data: mail } = useQuery<MailResponse>({
    queryKey: ['mail', 'dashboard'],
    queryFn: () => api.get('/mail?limit=5'),
    enabled: isReady,
  });

  if (isLoading || !player) {
    return (
      <Container size="xl">
        <Stack gap="md">
          <Skeleton height={80} radius="sm" />
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 8 }}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Skeleton height={200} radius="sm" />
                <Skeleton height={200} radius="sm" />
              </SimpleGrid>
              <Skeleton height={180} radius="sm" mt="md" />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="md">
                <Skeleton height={140} radius="sm" />
                <Skeleton height={160} radius="sm" />
                <Skeleton height={140} radius="sm" />
              </Stack>
            </Grid.Col>
          </Grid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Skeleton height={140} radius="sm" />
            <Skeleton height={140} radius="sm" />
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

  const untrainedCitizens = player.units?.find((u) => u.unitType === 'CITIZEN' && u.level === 1)?.quantity ?? 0;
  const totalUnits = player.units?.reduce((sum, u) => sum + u.quantity, 0) ?? 0;
  const totalItems = player.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  const armoryValue = computeArmoryValue(player.items ?? []);

  const offense = breakdown?.offense.total ?? player.stats?.offense ?? 0;
  const defense = breakdown?.defense.total ?? player.stats?.defense ?? 0;
  const spy = breakdown?.spy.total ?? player.stats?.spy ?? 0;
  const sentry = breakdown?.sentry.total ?? player.stats?.sentry ?? 0;
  const goldPerTurn = breakdown?.goldPerTurn.total ?? fort?.goldPerTurn ?? 0;
  const citizensPerDay = breakdown?.citizensPerDay.total ?? 0;
  const availablePoints = breakdown?.availablePoints ?? player.availablePoints ?? 0;
  const availableUpgrades = player.availableUpgrades ?? 0;

  const unreadCount = mail?.unreadCount ?? 0;

  const recommended = getRecommendedAction({
    totalUnits,
    attackTurns,
    availablePoints,
    availableUpgrades,
    fortHpPercent,
    gold,
    goldInBank,
    totalItems,
    untrainedCitizens,
  });

  const RecommendedIcon = recommended.icon;

  return (
    <Container size="xl">
      <Stack gap="md" className="ot-stagger">
        {/* ── Status Strip (not a card) ────────────────────────── */}
        <div className="ot-status-strip">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="sm" align="center">
              <Title order={3}>{player.displayName}&apos;s Kingdom</Title>
              <Badge variant="light" color={colorName} size="sm">
                {player.race}
              </Badge>
              <Badge variant="light" color="ot" size="sm">
                {player.class}
              </Badge>
            </Group>
            <Group gap="md" align="center">
              <Text size="sm" fw={600}>Level {level}</Text>
              {rank > 0 && (
                <Badge variant="light" color="ot" size="sm">
                  Rank #{rank}
                </Badge>
              )}
              {untrainedCitizens > 0 && (
                <Badge
                  variant="light"
                  color="yellow"
                  size="sm"
                  component={Link}
                  href="/battle/training"
                  style={{ cursor: 'pointer' }}
                  leftSection={<IconUsers size={12} />}
                >
                  {toLocale(untrainedCitizens)} idle citizens
                </Badge>
              )}
            </Group>
          </Group>
          <div style={{ marginTop: 8 }}>
            <Group justify="space-between" mb={4}>
              <Text size="xs" className="ot-text-dim">
                XP Progress
              </Text>
              <Text size="xs" className="ot-text-dim">
                {toLocale(experience)} / {toLocale(nextLevelXP || experience)}
              </Text>
            </Group>
            <Progress value={xpProgress} size="sm" color={colorName} radius="sm" />
            <Text size="xs" className="ot-text-dim" mt={4}>
              {xpToNext > 0 ? `${toLocale(xpToNext)} XP to next level (${Math.round(xpProgress)}%)` : 'Max level reached!'}
            </Text>
          </div>
        </div>

        {/* ── Main Grid: Left Column (8) + Side Rail (4) ──────── */}
        <Grid gutter="md">
          {/* Left Column */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="md">
              {/* Economy + Military side-by-side */}
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {/* Economy */}
                <OTCard accent header={
                  <Group gap="xs" align="center">
                    <IconCoins size={18} style={{ color: 'var(--ot-accent)' }} />
                    <Title order={4}>Economy</Title>
                  </Group>
                }>
                  <Stack gap="sm">
                    <StatRow label="Gold" value={toLocale(gold)} />
                    <StatRow label="Gold in Bank" value={toLocale(goldInBank)} />
                    <TooltipStat
                      label="Gold Per Turn"
                      value={`+${toLocale(goldPerTurn)}`}
                      valueColor="var(--ot-success)"
                      tooltip={breakdown?.goldPerTurn ? <GoldTooltipContent bd={breakdown.goldPerTurn} /> : 'Loading...'}
                      tooltipWidth={220}
                    />
                    <TooltipStat
                      label="Citizens Per Day"
                      value={`+${toLocale(citizensPerDay)}`}
                      valueColor="var(--ot-race-primary)"
                      tooltip={breakdown?.citizensPerDay ? <CitizensTooltipContent bd={breakdown.citizensPerDay} /> : 'Loading...'}
                      tooltipWidth={220}
                    />
                    <TooltipStat
                      label="Net Worth"
                      value={toLocale(gold + goldInBank + armoryValue)}
                      tooltip={
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
                      tooltipWidth={220}
                    />
                  </Stack>
                </OTCard>

                {/* Military Summary */}
                <OTCard header={
                  <Group gap="xs" align="center">
                    <IconSwords size={18} style={{ color: 'var(--ot-text-dim)' }} />
                    <Title order={4}>Military</Title>
                  </Group>
                }>
                  <Stack gap="sm">
                    <StatRow label="Total Units" value={toLocale(totalUnits)} />
                    {(['offense', 'defense', 'spy', 'sentry'] as const).map((stat) => {
                      const value = { offense, defense, spy, sentry }[stat];
                      const bd = breakdown?.[stat];
                      const det = breakdown?.detailed?.[stat];
                      const label = stat.charAt(0).toUpperCase() + stat.slice(1);
                      return (
                        <TooltipStat
                          key={stat}
                          label={label}
                          value={toLocale(value)}
                          tooltip={bd ? <StatTooltipContent label={label} bd={bd} detailed={det} /> : 'Loading...'}
                        />
                      );
                    })}
                  </Stack>
                </OTCard>
              </SimpleGrid>

              {/* Recent Activity (Activity Feed + Messages) */}
              <OTCard header={
                <Group justify="space-between" align="center">
                  <Group gap="xs" align="center">
                    <IconHistory size={18} style={{ color: 'var(--ot-text-dim)' }} />
                    <Title order={4}>Recent Activity</Title>
                  </Group>
                  <Group gap="md">
                    <Anchor component={Link} href="/world/activity" size="xs">
                      Activity
                    </Anchor>
                    <Anchor component={Link} href="/messaging" size="xs">
                      Messages {unreadCount > 0 && (
                        <Badge size="xs" color="red" variant="filled" circle ml={4}>
                          {unreadCount}
                        </Badge>
                      )}
                    </Anchor>
                  </Group>
                </Group>
              }>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {/* Activity column */}
                  <Stack gap="xs">
                    <Group gap={6}>
                      {(['my', 'alliance', 'server'] as const).map((scope) => (
                        <Badge
                          key={scope}
                          variant={activityScope === scope ? 'filled' : 'light'}
                          color={activityScope === scope ? 'blue' : 'gray'}
                          size="xs"
                          style={{ cursor: scope === 'alliance' && !firstAllianceId ? 'default' : 'pointer', opacity: scope === 'alliance' && !firstAllianceId ? 0.4 : 1 }}
                          onClick={() => {
                            if (scope === 'alliance' && !firstAllianceId) return;
                            setActivityScope(scope);
                          }}
                        >
                          {scope === 'my' ? 'My' : scope === 'alliance' ? 'Alliance' : 'Server'}
                        </Badge>
                      ))}
                    </Group>
                    {activeFeed && activeFeed.data.length > 0 ? (
                      activeFeed.data.map((item) => (
                        <ActivityFeedItem key={item.id} item={item} showPlayerName={activityScope !== 'my'} />
                      ))
                    ) : (
                      <Text size="xs" className="ot-text-dim">
                        {activityScope === 'alliance' && !firstAllianceId
                          ? 'Join an alliance to see activity.'
                          : 'No activity yet.'}
                      </Text>
                    )}
                  </Stack>

                  {/* Messages column */}
                  <Stack gap="xs">
                    <Text size="xs" fw={600} className="ot-text-dim" tt="uppercase">Messages</Text>
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
                              className={item.isRead ? 'ot-text-dim' : undefined}
                            >
                              {item.subject}
                            </Text>
                          </Group>
                          <Text size="xs" className="ot-text-dim" style={{ flexShrink: 0 }}>
                            {item.sender?.displayName ?? 'System'}
                          </Text>
                        </Group>
                      ))
                    ) : (
                      <Text size="xs" className="ot-text-dim">
                        No messages yet.
                      </Text>
                    )}
                  </Stack>
                </SimpleGrid>
              </OTCard>
            </Stack>
          </Grid.Col>

          {/* Side Rail */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              {/* Recommended Action */}
              <OTCard featured header={
                <Group gap="xs" align="center">
                  <IconBulb size={18} style={{ color: 'var(--ot-accent)' }} />
                  <Title order={4}>Recommended</Title>
                </Group>
              }>
                <Stack gap="sm" align="center" ta="center">
                  <ThemeIcon size={48} radius="xl" variant="light" color={recommended.color}>
                    <RecommendedIcon size={24} />
                  </ThemeIcon>
                  <Text fw={600} size="sm">{recommended.title}</Text>
                  <Text size="xs" className="ot-text-dim">{recommended.description}</Text>
                  <Button
                    component={Link}
                    href={recommended.href}
                    variant="light"
                    color={recommended.color}
                    size="sm"
                    fullWidth
                  >
                    Go
                  </Button>
                </Stack>
              </OTCard>

              {/* Rankings */}
              <OTCard header={
                <Group justify="space-between" align="center">
                  <Group gap="xs" align="center">
                    <IconTrophy size={18} style={{ color: 'var(--ot-accent)' }} />
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
                      <Title order={4} className="ot-tooltip-hint">
                        Rankings
                      </Title>
                    </Tooltip>
                  </Group>
                  <Anchor component={Link} href="/world/rankings" size="xs">
                    Leaderboard
                  </Anchor>
                </Group>
              }>
                <Stack gap="xs">
                  {([
                    { label: 'Overall', value: breakdown?.ranks?.overall ?? rank },
                    { label: 'Offense', value: breakdown?.ranks?.offense },
                    { label: 'Defense', value: breakdown?.ranks?.defense },
                    { label: 'Spy', value: breakdown?.ranks?.spy },
                    { label: 'Sentry', value: breakdown?.ranks?.sentry },
                    { label: 'Net Worth', value: breakdown?.ranks?.netWorth },
                  ] as const).map((item) => (
                    <StatRow
                      key={item.label}
                      label={item.label}
                      value={item.value ? `#${item.value}` : '--'}
                    />
                  ))}
                </Stack>
              </OTCard>

              {/* Proficiencies */}
              <OTCard header={
                <Group justify="space-between" align="center">
                  <Group gap="xs" align="center">
                    <IconStar size={18} style={{ color: 'var(--ot-accent)' }} />
                    <Title order={4}>Proficiencies</Title>
                  </Group>
                  {availablePoints > 0 && (
                    <Badge size="sm" color="green" variant="light">
                      {availablePoints} to spend
                    </Badge>
                  )}
                </Group>
              }>
                <Stack gap="xs">
                  {breakdown?.bonusPoints && breakdown.bonusPoints.length > 0 ? (
                    breakdown.bonusPoints
                      .filter((bp) => bp.level > 0)
                      .map((bp) => (
                        <StatRow
                          key={bp.bonusType}
                          label={bp.bonusType.charAt(0) + bp.bonusType.slice(1).toLowerCase()}
                          value={`Lv ${bp.level}`}
                        />
                      ))
                  ) : (
                    <Text size="sm" className="ot-text-dim">
                      No points allocated yet.
                    </Text>
                  )}
                  {availablePoints > 0 && (
                    <Anchor component={Link} href="/battle/proficiencies" size="sm">
                      Allocate points
                    </Anchor>
                  )}
                </Stack>
              </OTCard>
            </Stack>
          </Grid.Col>
        </Grid>

        {/* ── Bottom Row: Fort + Quick Actions ────────────────── */}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {/* Fortification */}
          <OTCard header={
            <Group gap="xs" align="center">
              <IconWall size={18} style={{ color: 'var(--ot-text-dim)' }} />
              <Title order={4}>Fortification</Title>
            </Group>
          }>
            <Stack gap="sm">
              <StatRow label="Fort" value={`${fortName} (Level ${fortLevel})`} />
              <div>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" className="ot-text-dim">
                    Hitpoints
                  </Text>
                  <Text size="xs" className="ot-text-dim">
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

          {/* Quick Actions */}
          <OTCard header={
            <Group gap="xs" align="center">
              <IconRocket size={18} style={{ color: 'var(--ot-text-dim)' }} />
              <Title order={4}>Quick Actions</Title>
            </Group>
          }>
            <Stack gap="sm">
              <SimpleGrid cols={2} spacing="xs">
                <Button
                  component={Link}
                  href="/battle/players"
                  variant="light"
                  color="red"
                  leftSection={<IconSwords size={16} />}
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
                  leftSection={<IconUsers size={16} />}
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
                  leftSection={<IconBuildingBank size={16} />}
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
                  leftSection={<IconTarget size={16} />}
                  size="sm"
                  fullWidth
                >
                  Armory
                </Button>
              </SimpleGrid>
            </Stack>
          </OTCard>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
