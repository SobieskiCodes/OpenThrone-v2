'use client';

import {
  Container,
  Stack,
  Title,
  Group,
  Text,
  Pagination,
  Skeleton,
  Badge,
} from '@mantine/core';
import { OTCard, ActivityFeedItem } from '@/components/ui';
import type { ActivityItem } from '@/components/ui';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { IconHistory } from '@tabler/icons-react';
import { ActivityType } from '@openthrone/shared';

const ACTIVITY_TYPES = Object.values(ActivityType);

const TYPE_LABELS: Record<string, string> = {
  ATTACK_WIN: 'Attack Won',
  ATTACK_LOSS: 'Attack Lost',
  DEFEND_WIN: 'Defend Won',
  DEFEND_LOSS: 'Defend Lost',
  SPY_SUCCESS: 'Spy Success',
  SPY_FAILED: 'Spy Failed',
  SPY_DETECTED: 'Spy Detected',
  LEVEL_UP: 'Level Up',
  ALLIANCE_CREATED: 'Alliance Created',
  ALLIANCE_JOINED: 'Alliance Joined',
  ALLIANCE_LEFT: 'Alliance Left',
  STRUCTURE_UPGRADED: 'Structure Upgraded',
};

interface FeedResponse {
  data: ActivityItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function ServerActivityPage() {
  const { api, isReady } = useApi();
  const [page, setPage] = useState(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: '20',
    ...(selectedType ? { type: selectedType } : {}),
  });

  const { data, isLoading } = useQuery<FeedResponse>({
    queryKey: ['activity', 'server', page, selectedType],
    queryFn: () => api.get(`/activity/server?${queryParams.toString()}`),
    enabled: isReady,
  });

  const handleTypeToggle = (type: string) => {
    setSelectedType((prev) => (prev === type ? null : type));
    setPage(1);
  };

  return (
    <Container size="md">
      <Stack gap="md">
        <Group gap="xs" align="center">
          <IconHistory size={24} style={{ color: 'var(--ot-accent)' }} />
          <Title order={2}>Server Activity</Title>
        </Group>

        {/* Type filter pills */}
        <Group gap={6} wrap="wrap">
          {ACTIVITY_TYPES.map((type) => (
            <Badge
              key={type}
              variant={selectedType === type ? 'filled' : 'light'}
              color={selectedType === type ? 'blue' : 'gray'}
              size="sm"
              style={{ cursor: 'pointer' }}
              onClick={() => handleTypeToggle(type)}
            >
              {TYPE_LABELS[type] ?? type}
            </Badge>
          ))}
        </Group>

        <OTCard>
          {isLoading ? (
            <Stack gap="xs">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} height={28} radius="sm" />
              ))}
            </Stack>
          ) : !data || data.data.length === 0 ? (
            <Text className="ot-text-dim" ta="center" py="lg">
              No activity yet. Start playing to see events here!
            </Text>
          ) : (
            <Stack gap="xs">
              {data.data.map((item) => (
                <ActivityFeedItem key={item.id} item={item} showPlayerName />
              ))}
            </Stack>
          )}
        </OTCard>

        {data && data.pagination.totalPages > 1 && (
          <Group justify="center">
            <Pagination
              value={page}
              onChange={setPage}
              total={data.pagination.totalPages}
              size="sm"
            />
          </Group>
        )}
      </Stack>
    </Container>
  );
}
