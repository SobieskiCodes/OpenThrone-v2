'use client';

import {
  Container,
  Title,
  Table,
  Badge,
  Text,
  Skeleton,
  Stack,
  Pagination,
  Group,
  SegmentedControl,
} from '@mantine/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/use-api';
import Link from 'next/link';

interface BattleLogEntry {
  id: number;
  attacker: { id: string; displayName: string; race: string };
  defender: { id: string; displayName: string; race: string };
  winner: string;
  type: string;
  goldStolen: string;
  xpGained: number;
  timestamp: string | null;
  isAttacker: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const RACE_COLORS: Record<string, string> = {
  HUMAN: 'blue',
  ELF: 'green',
  GOBLIN: 'orange',
  UNDEAD: 'grape',
};

const SPY_TYPES = ['intel', 'assassinate', 'infiltrate', 'steal_gold', 'sabotage'];

function getTypeBadge(log: BattleLogEntry) {
  if (SPY_TYPES.includes(log.type)) {
    const labels: Record<string, string> = {
      intel: 'Intel',
      assassinate: 'Assassination',
      infiltrate: 'Infiltration',
      steal_gold: 'Steal Gold',
      sabotage: 'Sabotage',
    };
    return (
      <Badge variant="light" size="sm" color="violet">
        {labels[log.type] ?? log.type}
      </Badge>
    );
  }
  return (
    <Badge variant="light" size="sm" color={log.isAttacker ? 'red' : 'blue'}>
      {log.isAttacker ? 'Attack' : 'Defense'}
    </Badge>
  );
}

function getGoldDisplay(log: BattleLogEntry, didWin: boolean) {
  if (SPY_TYPES.includes(log.type) && log.type !== 'steal_gold') {
    return (
      <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>--</Text>
    );
  }
  const goldAmount = parseInt(log.goldStolen, 10) || 0;
  return (
    <Text
      size="sm"
      style={{
        color: didWin ? 'var(--ot-success)' : 'var(--ot-danger)',
      }}
    >
      {didWin ? '+' : '-'}
      {goldAmount.toLocaleString()} gold
    </Text>
  );
}

export default function BattleHistoryPage() {
  const { api, isReady } = useApi();
  const router = useRouter();
  const [filterType, setFilterType] = useState('all');
  const [page, setPage] = useState(1);

  const { data: historyData, isLoading } = useQuery<PaginatedResponse<BattleLogEntry>>({
    queryKey: ['battle', 'history', filterType, page],
    queryFn: () => api.get(`/battle/history?type=${filterType}&page=${page}&limit=20`),
    enabled: isReady,
  });

  const formatDate = (timestamp: string | null) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Container size="lg">
      <Stack gap="md">
        <Title order={2}>
          Battle History
        </Title>

        <SegmentedControl
          data={[
            { value: 'all', label: 'All' },
            { value: 'attack', label: 'Attacks' },
            { value: 'defense', label: 'Defenses' },
            { value: 'spy', label: 'Spy Missions' },
          ]}
          value={filterType}
          onChange={(val) => {
            setFilterType(val);
            setPage(1);
          }}
        />

        {isLoading ? (
          <Skeleton height={400} />
        ) : (
          <>
            <div className="ot-table-scroll">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Opponent</Table.Th>
                    <Table.Th ta="center">Type</Table.Th>
                    <Table.Th ta="center">Result</Table.Th>
                    <Table.Th ta="right">Gold</Table.Th>
                    <Table.Th ta="right">XP</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {historyData?.data.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Text ta="center" style={{ color: 'var(--ot-text-dim)' }}>
                          No battle history yet.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                  {historyData?.data.map((log) => {
                    const opponent = log.isAttacker ? log.defender : log.attacker;
                    const didWin = log.isAttacker
                      ? log.winner === log.attacker.id
                      : log.winner === log.defender.id;

                    return (
                      <Table.Tr
                        key={log.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/battle/report/${log.id}`)}
                      >
                        <Table.Td>
                          <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                            {formatDate(log.timestamp)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Text
                              component={Link}
                              href={`/profile/${opponent.id}`}
                              fw={500}
                              style={{ color: 'var(--ot-gold)', textDecoration: 'none' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {opponent.displayName}
                            </Text>
                            <Badge
                              variant="light"
                              size="xs"
                              color={RACE_COLORS[opponent.race] ?? 'gray'}
                            >
                              {opponent.race}
                            </Badge>
                          </Group>
                        </Table.Td>
                        <Table.Td ta="center">
                          {getTypeBadge(log)}
                        </Table.Td>
                        <Table.Td ta="center">
                          <Badge
                            variant="filled"
                            size="sm"
                            color={didWin ? 'green' : 'red'}
                          >
                            {didWin ? 'Won' : 'Lost'}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right">
                          {getGoldDisplay(log, didWin)}
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm" fw={500} style={{ color: 'var(--ot-accent)' }}>
                            +{log.xpGained.toLocaleString()} XP
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>

            {historyData && historyData.pagination.totalPages > 1 && (
              <Group justify="center">
                <Pagination
                  total={historyData.pagination.totalPages}
                  value={page}
                  onChange={setPage}
                />
              </Group>
            )}
          </>
        )}
      </Stack>
    </Container>
  );
}
