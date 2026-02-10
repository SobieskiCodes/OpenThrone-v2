'use client';

import { Group, Text, ThemeIcon } from '@mantine/core';
import Link from 'next/link';
import {
  IconSwords,
  IconShield,
  IconEye,
  IconEyeOff,
  IconAlertTriangle,
  IconArrowUp,
  IconFlag,
  IconUserPlus,
  IconUserMinus,
  IconBuildingCastle,
} from '@tabler/icons-react';

export interface ActivityItem {
  id: number;
  activityType: string;
  player: { id: string; displayName: string };
  target: { id: string; displayName: string } | null;
  referenceId: number | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

const ACTIVITY_CONFIG: Record<
  string,
  { icon: typeof IconSwords; color: string; label: (item: ActivityItem) => string }
> = {
  ATTACK_WIN: {
    icon: IconSwords,
    color: 'green',
    label: (item) => `won attack against ${item.target?.displayName ?? 'unknown'}`,
  },
  ATTACK_LOSS: {
    icon: IconSwords,
    color: 'red',
    label: (item) => `lost attack against ${item.target?.displayName ?? 'unknown'}`,
  },
  DEFEND_WIN: {
    icon: IconShield,
    color: 'green',
    label: (item) => `defended against ${item.target?.displayName ?? 'unknown'}`,
  },
  DEFEND_LOSS: {
    icon: IconShield,
    color: 'red',
    label: (item) => `was defeated by ${item.target?.displayName ?? 'unknown'}`,
  },
  SPY_SUCCESS: {
    icon: IconEye,
    color: 'blue',
    label: (item) => `spy ${item.metadata?.missionType ?? 'mission'} succeeded`,
  },
  SPY_FAILED: {
    icon: IconEyeOff,
    color: 'orange',
    label: (item) => `spy ${item.metadata?.missionType ?? 'mission'} failed`,
  },
  SPY_DETECTED: {
    icon: IconAlertTriangle,
    color: 'yellow',
    label: () => `detected enemy spies`,
  },
  LEVEL_UP: {
    icon: IconArrowUp,
    color: 'teal',
    label: (item) => `reached level ${item.metadata?.newLevel ?? '?'}`,
  },
  ALLIANCE_CREATED: {
    icon: IconFlag,
    color: 'indigo',
    label: (item) => `created alliance ${item.metadata?.allianceName ?? ''}`,
  },
  ALLIANCE_JOINED: {
    icon: IconUserPlus,
    color: 'indigo',
    label: () => `joined an alliance`,
  },
  ALLIANCE_LEFT: {
    icon: IconUserMinus,
    color: 'gray',
    label: () => `left an alliance`,
  },
  STRUCTURE_UPGRADED: {
    icon: IconBuildingCastle,
    color: 'grape',
    label: (item) =>
      `upgraded ${(item.metadata?.upgradeType ?? '').toLowerCase().replace(/_/g, ' ')} to level ${item.metadata?.newLevel ?? '?'}`,
  },
};

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface ActivityFeedItemProps {
  item: ActivityItem;
  showPlayerName?: boolean;
}

export function ActivityFeedItem({ item, showPlayerName = true }: ActivityFeedItemProps) {
  const config = ACTIVITY_CONFIG[item.activityType];
  if (!config) return null;

  const Icon = config.icon;
  const message = config.label(item);
  const hasReport = item.referenceId && (
    item.activityType.startsWith('ATTACK_') || item.activityType.startsWith('DEFEND_')
  );

  const content = (
    <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
      <ThemeIcon size={22} radius="xl" variant="light" color={config.color} style={{ flexShrink: 0 }}>
        <Icon size={13} />
      </ThemeIcon>
      <Text size="xs" truncate style={{ flex: 1 }}>
        {showPlayerName && (
          <Text
            span
            fw={600}
            component={Link}
            href={`/profile/${item.player.id}`}
            style={{ color: 'var(--ot-accent)', textDecoration: 'none' }}
          >
            {item.player.displayName}
          </Text>
        )}
        {showPlayerName && ' '}
        {message}
      </Text>
      <Text size="xs" className="ot-text-dim" style={{ flexShrink: 0 }}>
        {getRelativeTime(item.createdAt)}
      </Text>
    </Group>
  );

  if (hasReport) {
    return (
      <Link
        href={`/battle/report/${item.referenceId}`}
        style={{ textDecoration: 'none', display: 'block' }}
      >
        {content}
      </Link>
    );
  }

  return content;
}
