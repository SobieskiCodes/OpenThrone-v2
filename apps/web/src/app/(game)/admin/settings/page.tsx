'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { notifications } from '@mantine/notifications';
import {
  Container,
  Title,
  Paper,
  Stack,
  Group,
  Text,
  Switch,
  NumberInput,
  Button,
  Loader,
  Alert,
} from '@mantine/core';
import { useState, useEffect } from 'react';

interface GameSetting {
  key: string;
  value: any;
  description?: string;
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, any>>({});

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<GameSetting[]>('/admin/settings'),
  });

  // Initialize local state when data loads
  useEffect(() => {
    if (settingsData) {
      const settingsMap = settingsData.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, any>);
      setSettings(settingsMap);
    }
  }, [settingsData]);

  const updateMutation = useMutation({
    mutationFn: (updates: Array<{ key: string; value: any }>) =>
      api.patch('/admin/settings', { settings: updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      notifications.show({
        title: 'Settings Updated',
        message: 'Game settings have been updated successfully',
        color: 'green',
      });
    },
    onError: (error: any) => {
      notifications.show({
        title: 'Update Failed',
        message: error.message || 'Failed to update settings',
        color: 'red',
      });
    },
  });

  const handleSave = () => {
    const updates = Object.entries(settings).map(([key, value]) => ({ key, value }));
    updateMutation.mutate(updates);
  };

  if (isLoading) {
    return (
      <Container size="md" py="xl">
        <Group justify="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Title order={1}>Game Settings</Title>

        <Alert color="blue" title="Admin Only">
          These settings affect all players globally. Changes take effect immediately.
        </Alert>

        <Paper p="md" withBorder>
          <Stack gap="md">
            <Title order={3}>Bot Configuration</Title>

            <Group justify="space-between">
              <div>
                <Text fw={500}>Bot Chat Enabled</Text>
                <Text size="sm" c="dimmed">
                  Allow bots to send messages in general chat (boasts, taunts, revenge threats)
                </Text>
              </div>
              <Switch
                checked={settings.bot_chat_enabled || false}
                onChange={(e) =>
                  setSettings({ ...settings, bot_chat_enabled: e.currentTarget.checked })
                }
              />
            </Group>

            <Title order={3} mt="md">
              Game Balance
            </Title>

            <NumberInput
              label="Turns per Tick"
              description="Attack turns awarded every 30 minutes"
              value={settings.turns_per_tick || 1}
              onChange={(value) => setSettings({ ...settings, turns_per_tick: value })}
              min={1}
              max={10}
            />

            <Stack gap="xs">
              <NumberInput
                label="Starting Gold"
                description="Gold awarded to new players"
                value={settings.starting_gold || 25000}
                onChange={(value) => setSettings({ ...settings, starting_gold: value })}
                min={1000}
                max={1000000}
                step={1000}
                thousandSeparator=","
              />
              <Group gap="xs">
                <Switch
                  checked={settings.starting_gold_banked || false}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      starting_gold_banked: e.currentTarget.checked,
                    })
                  }
                  size="sm"
                />
                <Text size="sm" c="dimmed">
                  Start with gold in bank instead of wallet
                </Text>
              </Group>
            </Stack>

            <NumberInput
              label="Starting Citizens"
              description="Citizens awarded to new players"
              value={settings.starting_citizens || 50}
              onChange={(value) => setSettings({ ...settings, starting_citizens: value })}
              min={10}
              max={500}
            />

            <Group justify="flex-end" mt="md">
              <Button
                onClick={handleSave}
                loading={updateMutation.isPending}
                disabled={!settingsData}
              >
                Save Changes
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
