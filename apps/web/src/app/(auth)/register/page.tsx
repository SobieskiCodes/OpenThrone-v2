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
  SimpleGrid,
  Box,
} from '@mantine/core';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const RACE_INFO: Record<string, { color: string; desc: string }> = {
  HUMAN: { color: '#1a8cff', desc: 'Balanced rulers of commerce and war' },
  ELF: { color: '#1aff80', desc: 'Swift and cunning, masters of espionage' },
  GOBLIN: { color: '#ff4444', desc: 'Fierce and relentless in battle' },
  UNDEAD: { color: '#a0a0a0', desc: 'Tireless legions that never rest' },
};

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

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.ok) {
        router.push('/home');
      } else {
        router.push('/login');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
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
            Forge your kingdom
          </Text>

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

          {/* Race selection with color hints */}
          <div>
            <Text size="sm" fw={500} mb={4} style={{ color: 'var(--ot-text)' }}>
              Race
            </Text>
            <SimpleGrid cols={2} spacing="xs">
              {Object.entries(RACE_INFO).map(([key, info]) => (
                <Box
                  key={key}
                  onClick={() => setRace(key)}
                  className="ot-race-card"
                  data-race={key}
                  p="sm"
                  style={{
                    borderRadius: '4px',
                    borderColor: race === key ? info.color : undefined,
                    boxShadow: race === key ? `0 0 8px ${info.color}30` : undefined,
                  }}
                >
                  <Text size="sm" fw={600} style={{ color: info.color }}>
                    {key}
                  </Text>
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                    {info.desc}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
          </div>

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
          <Text size="sm" ta="center" style={{ color: 'var(--ot-text-dim)' }}>
            Already have an account?{' '}
            <Anchor component={Link} href="/login" size="sm" style={{ color: 'var(--ot-gold)' }}>
              Sign in
            </Anchor>
          </Text>
        </Stack>
      </form>
    </Paper>
  );
}
