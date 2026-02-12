'use client';

import { Group, SimpleGrid, Skeleton, Stack, Text, ThemeIcon } from '@mantine/core';
import { OTCard } from './OTCard';
import { useApi } from '@/hooks/use-api';
import { useQuery } from '@tanstack/react-query';
import { toLocale } from '@openthrone/game-logic';
import { IconCoins, IconMail, IconShield, IconSword, IconTrendingUp } from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';

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

interface StatusData {
  economy?: {
    gold: string;
    attackTurns: number;
  };
  stats?: {
    rank: number;
  };
  availablePoints?: number;
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

  const { data: statusData, isLoading: statusLoading } = useQuery<StatusData>({
    queryKey: ['player', 'me', 'header-status'],
    queryFn: () => api.get('/player/me'),
    enabled: isReady,
    refetchInterval: 90000,
  });

  const { data: unreadData, isLoading: unreadLoading } = useQuery<{ count: number }>({
    queryKey: ['mail', 'unread-count', 'header-status'],
    queryFn: () => api.get('/mail/unread-count'),
    enabled: isReady,
    refetchInterval: 60000,
  });

  const stats: HeaderStatItem[] = [
    {
      label: 'Gold',
      value: `${toLocale(Number(statusData?.economy?.gold ?? 0))}`,
      icon: IconCoins,
    },
    {
      label: 'Attack Turns',
      value: toLocale(statusData?.economy?.attackTurns ?? 0),
      icon: IconSword,
    },
    {
      label: 'Kingdom Rank',
      value: `#${toLocale(statusData?.stats?.rank ?? 0)}`,
      icon: IconTrendingUp,
    },
    {
      label: 'Skill Points',
      value: toLocale(statusData?.availablePoints ?? 0),
      icon: IconShield,
    },
    {
      label: 'Unread Mail',
      value: toLocale(unreadData?.count ?? 0),
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

      {statusLoading || unreadLoading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="sm">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={56} radius="md" />
          ))}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="sm">
          {stats.map((stat) => (
            <HeaderStat key={stat.label} {...stat} />
          ))}
        </SimpleGrid>
      )}
    </OTCard>
  );
}
