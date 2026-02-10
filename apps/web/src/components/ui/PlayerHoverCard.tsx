'use client';

import { HoverCard, Group, Stack, Text, Badge } from '@mantine/core';
import Link from 'next/link';

const RACE_COLORS: Record<string, string> = {
  HUMAN: 'blue',
  ELF: 'green',
  GOBLIN: 'orange',
  UNDEAD: 'grape',
};

interface PlayerHoverCardProps {
  id: string;
  displayName: string;
  race: string;
  playerClass: string;
  level: number;
  rank?: number;
  isBot?: boolean;
  /** Extra rows shown below the default info */
  extra?: React.ReactNode;
  children?: React.ReactNode;
}

export function PlayerHoverCard({
  id,
  displayName,
  race,
  playerClass,
  level,
  rank,
  isBot,
  extra,
  children,
}: PlayerHoverCardProps) {
  return (
    <HoverCard width={220} shadow="md" openDelay={300} closeDelay={100} position="bottom-start">
      <HoverCard.Target>
        <Group gap={4} wrap="nowrap" style={{ display: 'inline-flex' }}>
          <Text
            component={Link}
            href={`/profile/${id}`}
            fw={600}
            size="sm"
            style={{ color: 'var(--ot-accent)', textDecoration: 'none' }}
          >
            {displayName}
          </Text>
          {isBot && (
            <Badge size="xs" variant="light" color="violet">
              BOT
            </Badge>
          )}
          {children}
        </Group>
      </HoverCard.Target>
      <HoverCard.Dropdown style={{ background: 'var(--ot-bg-surface-2)', border: '1px solid var(--ot-border)' }}>
        <Stack gap="xs">
          <Text fw={700} size="sm" style={{ color: 'var(--ot-accent)' }}>
            {displayName}
          </Text>
          <Group gap="xs">
            <Badge size="sm" variant="light" color={RACE_COLORS[race] ?? 'gray'} style={{ textTransform: 'capitalize' }}>
              {race.toLowerCase()}
            </Badge>
            <Badge size="sm" variant="light" color="gray" style={{ textTransform: 'capitalize' }}>
              {playerClass.toLowerCase()}
            </Badge>
          </Group>
          <Group justify="space-between">
            <Text size="xs" className="ot-text-dim">Level</Text>
            <Text size="xs" fw={600}>{level}</Text>
          </Group>
          {rank != null && rank > 0 && (
            <Group justify="space-between">
              <Text size="xs" className="ot-text-dim">Rank</Text>
              <Text size="xs" fw={600}>#{rank}</Text>
            </Group>
          )}
          {extra}
        </Stack>
      </HoverCard.Dropdown>
    </HoverCard>
  );
}
