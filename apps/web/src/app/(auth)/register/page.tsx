'use client';

import {
  Title, TextInput, PasswordInput, Button, Stack, Paper, Anchor, Text, Select,
} from '@mantine/core';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <Paper withBorder shadow="md" p="xl" radius="md">
      <Stack>
        <Title order={2} ta="center">Create your kingdom</Title>
        <TextInput label="Display Name" placeholder="Your ruler name" required />
        <TextInput label="Email" placeholder="you@example.com" required />
        <PasswordInput label="Password" placeholder="Min 8 characters" required />
        <Select label="Race" placeholder="Choose your race" data={['HUMAN', 'ELF', 'GOBLIN', 'UNDEAD']} required />
        <Select label="Class" placeholder="Choose your class" data={['FIGHTER', 'CLERIC', 'ASSASSIN', 'THIEF']} required />
        <Button fullWidth>Create Account</Button>
        <Text c="dimmed" size="sm" ta="center">
          Already have an account?{' '}
          <Anchor component={Link} href="/login" size="sm">Sign in</Anchor>
        </Text>
      </Stack>
    </Paper>
  );
}
