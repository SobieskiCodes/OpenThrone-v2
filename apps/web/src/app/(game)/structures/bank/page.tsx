'use client';

import {
  Container,
  Title,
  Group,
  Stack,
  Text,
  TextInput,
  Button,
  Tabs,
  Table,
  Pagination,
  Select,
  Skeleton,
  Alert,
} from '@mantine/core';
import { OTCard } from '@/components/ui';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { usePlayerStore } from '@/stores/player-store';
import { toLocale } from '@openthrone/game-logic';
import type { PlayerStateSnapshot } from '@openthrone/shared';

interface BankStatus {
  gold: string;
  goldInBank: string;
  depositsUsed: number;
  depositsMax: number;
  depositsRemaining: number;
}

interface HistoryRow {
  id: number;
  goldAmount: string;
  fromAccountType: string;
  toAccountType: string;
  dateTime: string;
  historyType: string;
}

interface HistoryResponse {
  rows: HistoryRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function BankPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyFilter, setHistoryFilter] = useState<string | null>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<BankStatus>({
    queryKey: ['bank', 'status'],
    queryFn: () => api.get('/bank/status'),
    enabled: isReady,
  });

  const { data: history, isLoading: historyLoading } = useQuery<HistoryResponse>({
    queryKey: ['bank', 'history', historyPage, historyFilter],
    queryFn: () =>
      api.get(
        `/bank/history?page=${historyPage}&limit=10${historyFilter && historyFilter !== 'all' ? `&filter=${historyFilter}` : ''}`,
      ),
    enabled: isReady,
  });

  const depositMutation = useMutation({
    mutationFn: (amount: string) => api.post<{ playerState: PlayerStateSnapshot }>('/bank/deposit', { amount }),
    onSuccess: (data) => {
      // Update Zustand store INSTANTLY
      if (data.playerState?.gold) {
        usePlayerStore.getState().setGold(BigInt(data.playerState.gold));
      }
      if (data.playerState?.goldInBank) {
        usePlayerStore.getState().setGoldInBank(BigInt(data.playerState.goldInBank));
      }

      // Still invalidate bank queries for background re-sync
      queryClient.invalidateQueries({ queryKey: ['bank'] });

      setError(null);
      setSuccess('Deposit successful!');
      setDepositAmount('');
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (amount: string) => api.post<{ playerState: PlayerStateSnapshot }>('/bank/withdraw', { amount }),
    onSuccess: (data) => {
      // Update Zustand store INSTANTLY
      if (data.playerState?.gold) {
        usePlayerStore.getState().setGold(BigInt(data.playerState.gold));
      }
      if (data.playerState?.goldInBank) {
        usePlayerStore.getState().setGoldInBank(BigInt(data.playerState.goldInBank));
      }

      // Still invalidate bank queries for background re-sync
      queryClient.invalidateQueries({ queryKey: ['bank'] });

      setError(null);
      setSuccess('Withdrawal successful!');
      setWithdrawAmount('');
    },
    onError: (err: Error) => {
      setSuccess(null);
      setError(err.message);
    },
  });

  if (statusLoading || !status) {
    return (
      <Container size="md">
        <Stack gap="md">
          <Skeleton height={40} width={200} />
          <Skeleton height={200} />
          <Skeleton height={300} />
        </Stack>
      </Container>
    );
  }

  const gold = Number(status.gold);
  const goldInBank = Number(status.goldInBank);
  const maxDeposit = Math.floor((gold * 80) / 100);

  const handleDeposit = () => {
    if (!depositAmount) return;
    setError(null);
    setSuccess(null);
    depositMutation.mutate(depositAmount);
  };

  const handleWithdraw = () => {
    if (!withdrawAmount) return;
    setError(null);
    setSuccess(null);
    withdrawMutation.mutate(withdrawAmount);
  };

  const getTransactionLabel = (row: HistoryRow) => {
    if (row.fromAccountType === 'HAND' && row.toAccountType === 'BANK') {
      return 'Deposit';
    }
    if (row.fromAccountType === 'BANK' && row.toAccountType === 'HAND') {
      return 'Withdrawal';
    }
    return row.historyType;
  };

  return (
    <Container size="md">
      <Stack gap="md">
        <Title order={2}>Bank</Title>

        {error && (
          <Alert color="red" onClose={() => setError(null)} withCloseButton>
            {error}
          </Alert>
        )}
        {success && (
          <Alert color="green" onClose={() => setSuccess(null)} withCloseButton>
            {success}
          </Alert>
        )}

        <Tabs defaultValue="transactions">
          <Tabs.List>
            <Tabs.Tab value="transactions">Deposit / Withdraw</Tabs.Tab>
            <Tabs.Tab value="history">History</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="transactions" pt="md">
            <Stack gap="md">
              {/* Balances */}
              <OTCard>
                <Group justify="space-between" wrap="wrap" gap="md">
                  <Stack gap={4}>
                    <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Gold on Hand</Text>
                    <Text fw={700} size="lg" className="ot-stat-value">{toLocale(gold)}</Text>
                  </Stack>
                  <Stack gap={4}>
                    <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Gold in Bank</Text>
                    <Text fw={700} size="lg" className="ot-stat-value">{toLocale(goldInBank)}</Text>
                  </Stack>
                  <Stack gap={4}>
                    <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>Deposits Today</Text>
                    <Text fw={700} size="lg" style={{ color: 'var(--ot-text)' }}>
                      {status.depositsUsed} / {status.depositsMax}
                    </Text>
                  </Stack>
                </Group>
              </OTCard>

              {/* Deposit */}
              <OTCard>
                <Stack gap="sm">
                  <Title order={4}>Deposit</Title>
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    Max deposit: {toLocale(maxDeposit)} (80% of gold on hand).{' '}
                    {status.depositsRemaining} deposit{status.depositsRemaining !== 1 ? 's' : ''} remaining today.
                  </Text>
                  <Group>
                    <TextInput
                      placeholder="Amount to deposit"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.currentTarget.value.replace(/\D/g, ''))}
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="light"
                      onClick={() => setDepositAmount(maxDeposit.toString())}
                    >
                      Max
                    </Button>
                    <Button
                      onClick={handleDeposit}
                      loading={depositMutation.isPending}
                      disabled={!depositAmount || status.depositsRemaining <= 0}
                    >
                      Deposit
                    </Button>
                  </Group>
                </Stack>
              </OTCard>

              {/* Withdraw */}
              <OTCard>
                <Stack gap="sm">
                  <Title order={4}>Withdraw</Title>
                  <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>
                    Withdrawals are unlimited.
                  </Text>
                  <Group>
                    <TextInput
                      placeholder="Amount to withdraw"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.currentTarget.value.replace(/\D/g, ''))}
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="light"
                      onClick={() => setWithdrawAmount(Math.floor(goldInBank * 0.25).toString())}
                    >
                      25%
                    </Button>
                    <Button
                      variant="light"
                      onClick={() => setWithdrawAmount(Math.floor(goldInBank * 0.5).toString())}
                    >
                      50%
                    </Button>
                    <Button
                      variant="light"
                      onClick={() => setWithdrawAmount(goldInBank.toString())}
                    >
                      100%
                    </Button>
                    <Button
                      onClick={handleWithdraw}
                      loading={withdrawMutation.isPending}
                      disabled={!withdrawAmount}
                    >
                      Withdraw
                    </Button>
                  </Group>
                </Stack>
              </OTCard>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="history" pt="md">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={4}>Transaction History</Title>
                <Select
                  value={historyFilter}
                  onChange={(val) => {
                    setHistoryFilter(val);
                    setHistoryPage(1);
                  }}
                  data={[
                    { value: 'all', label: 'All' },
                    { value: 'deposits', label: 'Deposits' },
                    { value: 'withdrawals', label: 'Withdrawals' },
                    { value: 'WAR_SPOILS', label: 'War Spoils' },
                    { value: 'ECONOMY', label: 'Economy' },
                  ]}
                  w={180}
                />
              </Group>

              {historyLoading ? (
                <Skeleton height={200} />
              ) : history && history.rows.length > 0 ? (
                <>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Date</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th ta="right">Amount</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {history.rows.map((row) => (
                        <Table.Tr key={row.id}>
                          <Table.Td>
                            {row.dateTime
                              ? new Date(row.dateTime).toLocaleString()
                              : 'N/A'}
                          </Table.Td>
                          <Table.Td>{getTransactionLabel(row)}</Table.Td>
                          <Table.Td ta="right">
                            <Text
                              c={
                                row.toAccountType === 'BANK'
                                  ? 'green'
                                  : 'red'
                              }
                              fw={600}
                            >
                              {row.toAccountType === 'BANK' ? '+' : '-'}
                              {toLocale(Number(row.goldAmount))}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                  {history.totalPages > 1 && (
                    <Group justify="center">
                      <Pagination
                        value={historyPage}
                        onChange={setHistoryPage}
                        total={history.totalPages}
                      />
                    </Group>
                  )}
                </>
              ) : (
                <Text c="dimmed" ta="center" py="xl">
                  No transactions found.
                </Text>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
