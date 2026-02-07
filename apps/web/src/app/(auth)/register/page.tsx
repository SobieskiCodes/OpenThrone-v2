'use client';

import {
  Title,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Paper,
  Anchor,
  Text,
  Select,
  Alert,
} from '@mantine/core';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [race, setRace] = useState<string | null>(null);
  const [playerClass, setPlayerClass] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!race || !playerClass) {
      setError('Please select both a race and a class.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          email,
          password,
          race,
          class: playerClass,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Registration failed' }));
        setError(data.message || 'Registration failed. Please try again.');
        return;
      }

      // Auto-sign in after successful registration
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.ok) {
        router.push('/home');
      } else {
        // Registration succeeded but auto-login failed; redirect to login
        router.push('/login');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper withBorder shadow="md" p="xl" radius="md">
      <form onSubmit={handleSubmit}>
        <Stack>
          <Title order={2} ta="center">
            Create your kingdom
          </Title>

          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}

          <TextInput
            label="Display Name"
            placeholder="Your ruler name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.currentTarget.value)}
          />
          <TextInput
            label="Email"
            placeholder="you@example.com"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <PasswordInput
            label="Password"
            placeholder="Min 8 characters"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            minLength={8}
          />
          <Select
            label="Race"
            placeholder="Choose your race"
            data={['HUMAN', 'ELF', 'GOBLIN', 'UNDEAD']}
            required
            value={race}
            onChange={setRace}
          />
          <Select
            label="Class"
            placeholder="Choose your class"
            data={['FIGHTER', 'CLERIC', 'ASSASSIN', 'THIEF']}
            required
            value={playerClass}
            onChange={setPlayerClass}
          />
          <Button type="submit" fullWidth loading={loading}>
            Create Account
          </Button>
          <Text c="dimmed" size="sm" ta="center">
            Already have an account?{' '}
            <Anchor component={Link} href="/login" size="sm">
              Sign in
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}
