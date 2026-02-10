'use client';

import {
  Container,
  Title,
  Stack,
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Button,
  Group,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { useRouter } from 'next/navigation';
import { OTCard } from '@/components/ui';

const RACE_OPTIONS = [
  { value: 'HUMAN', label: 'Human' },
  { value: 'ELF', label: 'Elf' },
  { value: 'GOBLIN', label: 'Goblin' },
  { value: 'UNDEAD', label: 'Undead' },
];

const CLASS_OPTIONS = [
  { value: 'FIGHTER', label: 'Fighter' },
  { value: 'CLERIC', label: 'Cleric' },
  { value: 'ASSASSIN', label: 'Assassin' },
  { value: 'THIEF', label: 'Thief' },
];

const STRATEGY_OPTIONS = [
  { value: 'WARRIOR', label: 'Warrior - High offense, aggressive attacker' },
  { value: 'TURTLE', label: 'Turtle - High defense, rarely attacks' },
  { value: 'ECONOMIST', label: 'Economist - Focused on economy and banking' },
  { value: 'SPYMASTER', label: 'Spymaster - Spy operations specialist' },
  { value: 'BALANCED', label: 'Balanced - Even distribution' },
];

export default function CreateBotPage() {
  const { api } = useApi();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [race, setRace] = useState('HUMAN');
  const [playerClass, setPlayerClass] = useState('FIGHTER');
  const [strategy, setStrategy] = useState('BALANCED');
  const [sessionsPerDay, setSessionsPerDay] = useState<number>(3);
  const [notes, setNotes] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/bots', {
        displayName,
        race,
        class: playerClass,
        strategy,
        sessionsPerDay,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      notifications.show({
        title: 'Bot Created',
        message: `${displayName} has been created successfully.`,
        color: 'green',
      });
      router.push('/admin/bots');
    },
    onError: (err: Error) => {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    },
  });

  return (
    <Container size="sm">
      <Stack gap="md">
        <Title order={2}>Create Bot</Title>

        <OTCard>
          <Stack gap="md">
            <TextInput
              label="Display Name"
              placeholder="BotWarrior"
              value={displayName}
              onChange={(e) => setDisplayName(e.currentTarget.value)}
              required
              description="3-20 chars, letters/numbers/underscores/hyphens"
            />

            <Group grow>
              <Select
                label="Race"
                data={RACE_OPTIONS}
                value={race}
                onChange={(val) => setRace(val ?? 'HUMAN')}
                required
              />
              <Select
                label="Class"
                data={CLASS_OPTIONS}
                value={playerClass}
                onChange={(val) => setPlayerClass(val ?? 'FIGHTER')}
                required
              />
            </Group>

            <Select
              label="Strategy"
              data={STRATEGY_OPTIONS}
              value={strategy}
              onChange={(val) => setStrategy(val ?? 'BALANCED')}
              required
            />

            <NumberInput
              label="Sessions Per Day"
              description="How many times per day the bot plays (1-5)"
              min={1}
              max={5}
              value={sessionsPerDay}
              onChange={(val) => setSessionsPerDay(Number(val) || 3)}
            />

            <Textarea
              label="Notes"
              placeholder="Optional notes about this bot..."
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              maxLength={500}
            />

            <Group justify="flex-end">
              <Button variant="default" onClick={() => router.push('/admin/bots')}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                loading={createMutation.isPending}
                disabled={!displayName || displayName.length < 3}
              >
                Create Bot
              </Button>
            </Group>
          </Stack>
        </OTCard>
      </Stack>
    </Container>
  );
}
