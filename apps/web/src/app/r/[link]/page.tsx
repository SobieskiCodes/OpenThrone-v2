'use client';

import { useParams } from 'next/navigation';
import {
  Title,
  Text,
  Container,
  Paper,
  Stack,
  Button,
  Center,
  Alert,
  Loader,
} from '@mantine/core';
import { useQuery, useMutation } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchLinkInfo(link: string) {
  const res = await fetch(`${API_URL}/api/recruitment/link/${link}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Invalid link' }));
    throw new Error(err.message || 'Invalid link');
  }
  return res.json();
}

async function claimLink(link: string, captchaToken?: string) {
  const res = await fetch(`${API_URL}/api/recruitment/link/${link}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captchaToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Claim failed' }));
    throw new Error(err.message || 'Claim failed');
  }
  return res.json();
}

export default function RecruitLinkPage() {
  const params = useParams<{ link: string }>();
  const link = params.link;

  const { data, isLoading, error } = useQuery({
    queryKey: ['recruit-link', link],
    queryFn: () => fetchLinkInfo(link),
    enabled: !!link,
  });

  const claim = useMutation({
    mutationFn: () => claimLink(link),
  });

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100vh">
        <Container size="xs">
          <Paper withBorder p="xl" radius="md">
            <Stack align="center" gap="md">
              <Title order={2}>Invalid Link</Title>
              <Text c="dimmed">
                This recruitment link is invalid or has expired.
              </Text>
            </Stack>
          </Paper>
        </Container>
      </Center>
    );
  }

  return (
    <Center h="100vh">
      <Container size="xs">
        <Paper withBorder p="xl" radius="md">
          <Stack align="center" gap="md">
            <Title order={2}>OpenThrone Recruitment</Title>
            <Text size="lg" ta="center">
              <Text span fw={700}>
                {data?.referrerName}
              </Text>{' '}
              has invited you to help grow their kingdom!
            </Text>

            {claim.isSuccess ? (
              <Alert color="green" w="100%">
                {claim.data?.message || 'Recruitment successful! Thank you.'}
              </Alert>
            ) : claim.isError ? (
              <>
                <Alert color="red" w="100%">
                  {(claim.error as Error).message}
                </Alert>
                <Button
                  size="lg"
                  onClick={() => claim.mutate()}
                  loading={claim.isPending}
                >
                  Try Again
                </Button>
              </>
            ) : (
              <>
                <Text size="sm" c="dimmed" ta="center">
                  Click the button below to help recruit citizens for{' '}
                  {data?.referrerName}.
                </Text>
                <Button
                  size="lg"
                  onClick={() => claim.mutate()}
                  loading={claim.isPending}
                >
                  Help Recruit!
                </Button>
              </>
            )}

            <Text size="xs" c="dimmed" ta="center">
              Want to play? Create your own kingdom at OpenThrone!
            </Text>
          </Stack>
        </Paper>
      </Container>
    </Center>
  );
}
