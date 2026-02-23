'use client';

import { Group, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import { OTCard } from './OTCard';
import { useApi } from '@/hooks/use-api';
import { useQuery } from '@tanstack/react-query';
import { toLocale } from '@openthrone/game-logic';
import { IconCoins, IconMail, IconShield, IconSword, IconTrendingUp } from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';
import { usePlayerStore } from '@/stores/player-store';

interface HeaderStatItem {
  label: string;
  value: string;
  icon: TablerIcon;
}

interface PageHeaderStatusProps {
  title: string;
  subtitle?: string;
  icon?: TablerIcon;
  rightSection?: React.ReactNode;
}

interface RankData {
  stats?: {
    rank: number;
  };
}

function HeaderStat({ label, value, icon: Icon }: HeaderStatItem) {
  return (
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon variant="light" radius="md" size="lg" color="yellow">
        <Icon size={16} />
      </ThemeIcon>
      <Stack gap={0}>
        <Text size="xs" className="ot-text-dim">{label}</Text>
        <Text size="sm" fw={700}>{value}</Text>
      </Stack>
    </Group>
  );
}

export function PageHeaderStatus({ title, subtitle, icon: Icon, rightSection }: PageHeaderStatusProps) {
  const { api, isReady } = useApi();

  // Read frequently-changing state from Zustand for instant updates
  const gold = usePlayerStore((state) => state.getGold());
  const attackTurns = usePlayerStore((state) => state.attackTurns);
  const availablePoints = usePlayerStore((state) => state.availablePoints);
  const unreadMail = usePlayerStore((state) => state.unreadMail);

  // Fetch rank separately (updated on turn tick schedule, not instant)
  const { data: rankData } = useQuery<RankData>({
    queryKey: ['player', 'me', 'rank'],
    queryFn: () => api.get('/player/me'),
    enabled: isReady,
    staleTime: 300000, // 5 minutes (rank updates on turn tick)
  });

  const stats: HeaderStatItem[] = [
    {
      label: 'Gold',
      value: `${toLocale(Number(gold))}`,
      icon: IconCoins,
    },
    {
      label: 'Attack Turns',
      value: toLocale(attackTurns),
      icon: IconSword,
    },
    {
      label: 'Kingdom Rank',
      value: `#${toLocale(rankData?.stats?.rank ?? 0)}`,
      icon: IconTrendingUp,
    },
    {
      label: 'Skill Points',
      value: toLocale(availablePoints),
      icon: IconShield,
    },
    {
      label: 'Unread Mail',
      value: toLocale(unreadMail),
      icon: IconMail,
    },
  ];

  return (
    <OTCard featured p="md">
      <Group justify="space-between" align="flex-start" mb="md">
        <Group gap="sm">
          {Icon && (
            <ThemeIcon variant="light" size={40} radius="md" color="yellow">
              <Icon size={20} />
            </ThemeIcon>
          )}
          <Stack gap={0}>
            <Text fw={800} size="xl">{title}</Text>
            {subtitle && (
              <Text size="sm" className="ot-text-dim">{subtitle}</Text>
            )}
          </Stack>
        </Group>
        {rightSection}
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="sm">
        {stats.map((stat) => (
          <HeaderStat key={stat.label} {...stat} />
        ))}
      </SimpleGrid>
    </OTCard>
  );
}
