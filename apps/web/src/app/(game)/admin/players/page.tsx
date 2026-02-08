'use client';

import {
  Title,
  Table,
  TextInput,
  Select,
  Group,
  Badge,
  Pagination,
  Stack,
  Loader,
  Center,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface PlayerRow {
  id: string;
  displayName: string;
  email: string;
  status: string;
  gold: string;
  experience: number;
  rank: number;
  permissions: string[];
  lastActive: string | null;
  createdAt: string;
}

interface PlayersResponse {
  rows: PlayerRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'IDLE', label: 'Idle' },
  { value: 'BANNED', label: 'Banned' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'VACATION', label: 'Vacation' },
  { value: 'CLOSED', label: 'Closed' },
];

export default function AdminPlayersPage() {
  const { api, isReady } = useApi();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery<PlayersResponse>({
    queryKey: ['admin', 'players', page, search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      return api.get(`/admin/players?${params.toString()}`);
    },
    enabled: isReady,
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'green';
      case 'BANNED':
        return 'red';
      case 'SUSPENDED':
        return 'orange';
      case 'IDLE':
        return 'gray';
      case 'VACATION':
        return 'blue';
      default:
        return 'gray';
    }
  };

  return (
    <Stack gap="lg">
      <Title order={2}>Player Management</Title>

      <Group>
        <TextInput
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            setPage(1);
          }}
          style={{ flex: 1, maxWidth: 300 }}
        />
        <Select
          data={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v ?? '');
            setPage(1);
          }}
          placeholder="Filter by status"
          clearable
          style={{ width: 180 }}
        />
      </Group>

      {isLoading ? (
        <Center h={200}>
          <Loader />
        </Center>
      ) : (
        <>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Gold</Table.Th>
                <Table.Th>Rank</Table.Th>
                <Table.Th>Last Active</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data?.rows?.length ? (
                data.rows.map((player) => (
                  <Table.Tr
                    key={player.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() =>
                      router.push(`/admin/players/${player.id}`)
                    }
                  >
                    <Table.Td>
                      <Group gap="xs">
                        {player.displayName}
                        {player.permissions.includes('ADMINISTRATOR') && (
                          <Badge size="xs" color="violet">
                            Admin
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>{player.email}</Table.Td>
                    <Table.Td>
                      <Badge color={statusColor(player.status)} size="sm">
                        {player.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {BigInt(player.gold).toLocaleString()}
                    </Table.Td>
                    <Table.Td>#{player.rank || '-'}</Table.Td>
                    <Table.Td>
                      {player.lastActive
                        ? new Date(player.lastActive).toLocaleDateString()
                        : 'Never'}
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text c="dimmed" ta="center">
                      No players found
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          {data && data.totalPages > 1 && (
            <Center>
              <Pagination
                total={data.totalPages}
                value={page}
                onChange={setPage}
              />
            </Center>
          )}
        </>
      )}
    </Stack>
  );
}
