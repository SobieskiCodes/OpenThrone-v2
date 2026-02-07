'use client';

import { Title, TextInput, PasswordInput, Button, Stack, Paper, Anchor, Text } from '@mantine/core';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <Paper withBorder shadow="md" p="xl" radius="md">
      <Stack>
        <Title order={2} ta="center">Welcome back</Title>
        <TextInput label="Email" placeholder="you@example.com" required />
        <PasswordInput label="Password" placeholder="Your password" required />
        <Button fullWidth>Sign in</Button>
        <Text c="dimmed" size="sm" ta="center">
          Don&apos;t have an account?{' '}
          <Anchor component={Link} href="/register" size="sm">Register</Anchor>
        </Text>
      </Stack>
    </Paper>
  );
}
