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
  Alert,
} from '@mantine/core';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[login] signIn result:', result);
      }

      if (result?.error) {
        setError('Invalid email or password. Please try again.');
      } else {
        router.push('/home');
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[login] signIn error:', err);
      }
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper withBorder shadow="md" p="xl" radius="md">
      <form onSubmit={handleSubmit}>
        <Stack>
          <Title order={2} ta="center">
            Welcome back
          </Title>

          {error && (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          )}

          <TextInput
            label="Email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            type="email"
          />
          <PasswordInput
            label="Password"
            placeholder="Your password"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Button type="submit" fullWidth loading={loading}>
            Sign in
          </Button>
          <Text c="dimmed" size="sm" ta="center">
            Don&apos;t have an account?{' '}
            <Anchor component={Link} href="/register" size="sm">
              Register
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}
