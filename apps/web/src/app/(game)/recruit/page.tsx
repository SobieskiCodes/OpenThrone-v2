'use client';

import {
  Title,
  Text,
  Container,
  Paper,
  Group,
  Stack,
  Button,
  CopyButton,
  TextInput,
  Table,
  Badge,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface RecruitmentStatus {
  recruitLink: string;
  recruitingBonusLevel: number;
  citizensPerRecruit: number;
  citizensPerAutoRecruit: number;
  houseLevel: number;
  todayRecruits: number;
  maxRecruitsPerDay: number;
  history: Array<{
    id: number;
    fromUser: string | null;
    timestamp: string | null;
  }>;
}

export default function RecruitmentPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<RecruitmentStatus>({
    queryKey: ['recruitment', 'status'],
    queryFn: () => api.get('/recruitment/status'),
  });

  const autoRecruit = useMutation({
    mutationFn: () => api.post<{ citizensGained: number; message: string }>('/recruitment/auto-recruit'),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['recruitment'] });
      notifications.show({
        title: 'Auto-Recruit',
        message: result.message,
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Auto-Recruit Failed',
        message: err.message,
        color: 'red',
      });
    },
  });

  if (isLoading || !data) {
    return (
      <Container>
        <Title order={2}>Recruitment</Title>
        <Text c="dimmed">Loading...</Text>
      </Container>
    );
  }

  const recruitUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${data.recruitLink}`;

  return (
    <Container>
      <Title order={2} mb="md">
        Recruitment
      </Title>

      <Stack gap="lg">
        {/* Recruit Link */}
        <Paper withBorder p="md">
          <Title order={4} mb="sm">
            Your Recruit Link
          </Title>
          <Text size="sm" c="dimmed" mb="sm">
            Share this link to earn citizens when visitors click it.
            Each click awards you {data.citizensPerRecruit} citizens.
          </Text>
          <Group>
            <TextInput
              value={recruitUrl}
              readOnly
              style={{ flex: 1 }}
            />
            <CopyButton value={recruitUrl}>
              {({ copied, copy }) => (
                <Button
                  color={copied ? 'teal' : 'blue'}
                  onClick={copy}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              )}
            </CopyButton>
          </Group>
          <Group mt="sm" gap="xs">
            <Badge variant="light">
              Today: {data.todayRecruits} / {data.maxRecruitsPerDay}
            </Badge>
            {data.recruitingBonusLevel > 0 && (
              <Badge variant="light" color="green">
                Recruiting Bonus: +{data.recruitingBonusLevel}%
              </Badge>
            )}
          </Group>
        </Paper>

        {/* Auto-Recruit */}
        <Paper withBorder p="md">
          <Title order={4} mb="sm">
            Auto-Recruit
          </Title>
          <Text size="sm" c="dimmed" mb="sm">
            Generate citizens based on your housing level. Currently: Housing
            Level {data.houseLevel} ({data.citizensPerAutoRecruit} citizens per
            recruitment).
          </Text>
          <Button
            onClick={() => autoRecruit.mutate()}
            loading={autoRecruit.isPending}
          >
            Recruit Citizens
          </Button>
        </Paper>

        {/* History */}
        <Paper withBorder p="md">
          <Title order={4} mb="sm">
            Recent Recruitment History
          </Title>
          {data.history.length === 0 ? (
            <Alert variant="light" color="gray">
              No recruitment history yet. Share your link to get started!
            </Alert>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>Date</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.history.map((entry) => (
                  <Table.Tr key={entry.id}>
                    <Table.Td>
                      {entry.fromUser ? `Player Referral` : 'Link Click'}
                    </Table.Td>
                    <Table.Td>
                      {entry.timestamp
                        ? new Date(entry.timestamp).toLocaleString()
                        : 'Unknown'}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}
