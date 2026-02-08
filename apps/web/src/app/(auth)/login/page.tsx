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
    <Paper className="ot-auth-card" shadow="lg" p="xl" radius="sm">
      <form onSubmit={handleSubmit}>
        <Stack>
          <Title order={1} ta="center" style={{ color: 'var(--ot-gold)' }}>
            OpenThrone
          </Title>
          <Text ta="center" size="sm" style={{ color: 'var(--ot-text-dim)' }}>
            Welcome back, ruler
          </Text>

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
          <Text size="sm" ta="center" style={{ color: 'var(--ot-text-dim)' }}>
            Don&apos;t have an account?{' '}
            <Anchor component={Link} href="/register" size="sm" style={{ color: 'var(--ot-gold)' }}>
              Register
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}
