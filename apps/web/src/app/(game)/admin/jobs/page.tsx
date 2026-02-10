'use client';

import {
  Title,
  Table,
  Select,
  Pagination,
  Badge,
  Stack,
  Loader,
  Center,
  Text,
  Group,
  Paper,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { useState } from 'react';

interface JobLog {
  id: number;
  job_name: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  players_processed: number;
  error_message: string | null;
}

interface JobLogsResponse {
  rows: JobLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface SchedulerStatus {
  jobs: Record<string, JobLog | null>;
  enabled: {
    turn_tick: boolean;
    daily_tick: boolean;
    bot_scheduler: boolean;
  };
}

const JOB_FILTER_OPTIONS = [
  { value: '', label: 'All Jobs' },
  { value: 'turn_tick', label: 'Turn Tick' },
  { value: 'daily_tick', label: 'Daily Tick' },
  { value: 'bot_session', label: 'Bot Session' },
];

export default function AdminJobsPage() {
  const { api, isReady } = useApi();
  const [page, setPage] = useState(1);
  const [jobNameFilter, setJobNameFilter] = useState('');

  const { data: status } = useQuery<SchedulerStatus>({
    queryKey: ['admin', 'scheduler', 'status'],
    queryFn: () => api.get('/scheduler/status'),
    enabled: isReady,
    refetchInterval: 60_000,
  });

  const { data, isLoading } = useQuery<JobLogsResponse>({
    queryKey: ['admin', 'jobs', page, jobNameFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (jobNameFilter) params.set('jobName', jobNameFilter);
      return api.get(`/scheduler/logs?${params.toString()}`);
    },
    enabled: isReady,
  });

  return (
    <Stack gap="lg">
      <Title order={2}>Job History</Title>

      {status && (
        <Paper p="sm" withBorder>
          <Group gap="xl">
            {[
              { label: 'Turn Tick', key: 'turn_tick' as const, jobName: 'turn_tick' },
              { label: 'Daily Tick', key: 'daily_tick' as const, jobName: 'daily_tick' },
              { label: 'Bot Scheduler', key: 'bot_scheduler' as const, jobName: 'bot_session' },
            ].map(({ label, key, jobName }) => (
              <Group gap={6} key={key}>
                <Text size="sm" style={{ color: 'var(--ot-text-dim)' }}>{label}:</Text>
                <Badge size="sm" variant="light" color={status.enabled[key] ? 'green' : 'red'}>
                  {status.enabled[key] ? 'Enabled' : 'Disabled'}
                </Badge>
                {status.jobs[jobName] && (
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                    Last: {new Date(status.jobs[jobName]!.started_at).toLocaleString()}
                  </Text>
                )}
              </Group>
            ))}
          </Group>
        </Paper>
      )}

      <Group>
        <Select
          data={JOB_FILTER_OPTIONS}
          value={jobNameFilter}
          onChange={(v) => {
            setJobNameFilter(v ?? '');
            setPage(1);
          }}
          placeholder="Filter by job"
          clearable
          style={{ width: 200 }}
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
                <Table.Th>ID</Table.Th>
                <Table.Th>Job Name</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Started</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>Players Processed</Table.Th>
                <Table.Th>Error</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data?.rows?.length ? (
                data.rows.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>{log.id}</Table.Td>
                    <Table.Td>{log.job_name}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          log.status === 'COMPLETED'
                            ? 'green'
                            : log.status === 'RUNNING'
                              ? 'blue'
                              : 'red'
                        }
                        size="sm"
                      >
                        {log.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {new Date(log.started_at).toLocaleString()}
                    </Table.Td>
                    <Table.Td>
                      {log.duration_ms != null ? `${log.duration_ms}ms` : '-'}
                    </Table.Td>
                    <Table.Td>{log.players_processed}</Table.Td>
                    <Table.Td>
                      {log.error_message ? (
                        <Text c="red" size="xs" lineClamp={1}>
                          {log.error_message}
                        </Text>
                      ) : (
                        '-'
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text c="dimmed" ta="center">
                      No job logs found
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
