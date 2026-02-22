'use client';

import { Modal, Tabs, Stack, Text, SimpleGrid, Paper, Group, Badge, Button, Textarea, PasswordInput } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { usePlayerStore } from '@/stores/player-store';

interface Cosmetic {
  id: string;
  type: 'NAME_COLOR' | 'ICON';
  name: string;
  value: string;
  price: string;
  description: string;
}

interface OwnedCosmetic {
  id: string;
  type: 'NAME_COLOR' | 'ICON';
  name: string;
  value: string;
  equipped: boolean;
}

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
}

export function SettingsModal({ opened, onClose }: SettingsModalProps) {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>('cosmetics');

  // Fetch available cosmetics
  const { data: cosmeticsData } = useQuery<{ cosmetics: Cosmetic[] }>({
    queryKey: ['shop', 'cosmetics'],
    queryFn: () => api.get('/shop/cosmetics'),
    enabled: isReady && opened,
  });
  const cosmetics = cosmeticsData?.cosmetics ?? [];

  // Fetch owned cosmetics
  const { data: ownedData } = useQuery<{ cosmetics: OwnedCosmetic[] }>({
    queryKey: ['shop', 'cosmetics', 'owned'],
    queryFn: () => api.get('/shop/cosmetics/owned'),
    enabled: isReady && opened,
  });
  const ownedCosmetics = ownedData?.cosmetics ?? [];

  const purchaseMutation = useMutation({
    mutationFn: (cosmeticId: string) => api.post('/shop/cosmetics/purchase', { cosmeticId }),
    onSuccess: (data: any) => {
      if (data.playerState?.gold) {
        usePlayerStore.getState().setGold(BigInt(data.playerState.gold));
      }
      queryClient.invalidateQueries({ queryKey: ['shop', 'cosmetics', 'owned'] });
      notifications.show({
        title: 'Purchased!',
        message: 'Cosmetic successfully purchased',
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Purchase Failed',
        message: err.message,
        color: 'red',
      });
    },
  });

  const equipMutation = useMutation({
    mutationFn: (cosmeticId: string) => api.post('/shop/cosmetics/equip', { cosmeticId, equipped: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop', 'cosmetics', 'owned'] });
      notifications.show({
        title: 'Equipped!',
        message: 'Cosmetic is now active',
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Equip Failed',
        message: err.message,
        color: 'red',
      });
    },
  });

  const nameColors = cosmetics.filter((c) => c.type === 'NAME_COLOR');
  const icons = cosmetics.filter((c) => c.type === 'ICON');

  const ownedNameColors = ownedCosmetics.filter((c) => c.type === 'NAME_COLOR');
  const ownedIcons = ownedCosmetics.filter((c) => c.type === 'ICON');

  const isOwned = (cosmeticId: string) => {
    return ownedCosmetics.some((c) => c.id === cosmeticId);
  };

  const isEquipped = (cosmeticId: string) => {
    return ownedCosmetics.some((c) => c.id === cosmeticId && c.equipped);
  };

  const gold = usePlayerStore((state) => state.getGold());

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={600} size="lg">Settings</Text>}
      size="xl"
      centered
    >
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="cosmetics">Cosmetics</Tabs.Tab>
          <Tabs.Tab value="profile">Profile</Tabs.Tab>
          <Tabs.Tab value="account">Account</Tabs.Tab>
        </Tabs.List>

        {/* Cosmetics Tab */}
        <Tabs.Panel value="cosmetics" pt="md">
          <Stack gap="lg">
            <Group justify="space-between" align="center">
              <Text size="sm" className="ot-text-dim">
                Customize your appearance with name colors and icons
              </Text>
              <Text size="sm" fw={600} style={{ color: 'var(--ot-gold)' }}>
                Gold: {gold.toLocaleString()}
              </Text>
            </Group>

            {/* Name Colors */}
            <Stack gap="sm">
              <Text fw={600} size="md">Name Colors</Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {nameColors.map((cosmetic) => {
                  const owned = isOwned(cosmetic.id);
                  const equipped = isEquipped(cosmetic.id);

                  return (
                    <Paper key={cosmetic.id} p="md" withBorder radius="md">
                      <Stack gap="xs">
                        <Group justify="space-between" align="center">
                          <Text
                            fw={600}
                            size="lg"
                            style={{ color: cosmetic.value }}
                          >
                            {cosmetic.name}
                          </Text>
                          {equipped && (
                            <Badge size="sm" color="green" variant="filled">
                              Equipped
                            </Badge>
                          )}
                          {owned && !equipped && (
                            <Badge size="sm" color="blue" variant="light">
                              Owned
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" className="ot-text-dim">
                          {cosmetic.description}
                        </Text>
                        <Group justify="space-between" align="center" mt="xs">
                          <Text size="sm" fw={600} style={{ color: 'var(--ot-gold)' }}>
                            {Number(cosmetic.price).toLocaleString()} gold
                          </Text>
                          {!owned ? (
                            <Button
                              size="xs"
                              variant="light"
                              onClick={() => purchaseMutation.mutate(cosmetic.id)}
                              loading={purchaseMutation.isPending}
                              disabled={gold < BigInt(cosmetic.price)}
                            >
                              Purchase
                            </Button>
                          ) : !equipped ? (
                            <Button
                              size="xs"
                              variant="filled"
                              onClick={() => equipMutation.mutate(cosmetic.id)}
                              loading={equipMutation.isPending}
                            >
                              Equip
                            </Button>
                          ) : (
                            <Button size="xs" variant="filled" disabled>
                              Active
                            </Button>
                          )}
                        </Group>
                      </Stack>
                    </Paper>
                  );
                })}
              </SimpleGrid>
            </Stack>

            {/* Icons */}
            <Stack gap="sm">
              <Text fw={600} size="md">Icons</Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {icons.map((cosmetic) => {
                  const owned = isOwned(cosmetic.id);
                  const equipped = isEquipped(cosmetic.id);

                  return (
                    <Paper key={cosmetic.id} p="md" withBorder radius="md">
                      <Stack gap="xs">
                        <Group justify="space-between" align="center">
                          <Group gap="xs">
                            <Text size="2rem">{cosmetic.value}</Text>
                            <Text fw={600} size="md">
                              {cosmetic.name}
                            </Text>
                          </Group>
                          {equipped && (
                            <Badge size="sm" color="green" variant="filled">
                              Equipped
                            </Badge>
                          )}
                          {owned && !equipped && (
                            <Badge size="sm" color="blue" variant="light">
                              Owned
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" className="ot-text-dim">
                          {cosmetic.description}
                        </Text>
                        <Group justify="space-between" align="center" mt="xs">
                          <Text size="sm" fw={600} style={{ color: 'var(--ot-gold)' }}>
                            {Number(cosmetic.price).toLocaleString()} gold
                          </Text>
                          {!owned ? (
                            <Button
                              size="xs"
                              variant="light"
                              onClick={() => purchaseMutation.mutate(cosmetic.id)}
                              loading={purchaseMutation.isPending}
                              disabled={gold < BigInt(cosmetic.price)}
                            >
                              Purchase
                            </Button>
                          ) : !equipped ? (
                            <Button
                              size="xs"
                              variant="filled"
                              onClick={() => equipMutation.mutate(cosmetic.id)}
                              loading={equipMutation.isPending}
                            >
                              Equip
                            </Button>
                          ) : (
                            <Button size="xs" variant="filled" disabled>
                              Active
                            </Button>
                          )}
                        </Group>
                      </Stack>
                    </Paper>
                  );
                })}
              </SimpleGrid>
            </Stack>
          </Stack>
        </Tabs.Panel>

        {/* Profile Tab */}
        <Tabs.Panel value="profile" pt="md">
          <Stack gap="md">
            <Text size="sm" className="ot-text-dim">
              Edit your profile information
            </Text>
            <Textarea
              label="Bio"
              placeholder="Tell others about yourself..."
              description="Max 500 characters"
              rows={4}
              maxLength={500}
            />
            <Button variant="filled" disabled>
              Save Profile (Coming Soon)
            </Button>
          </Stack>
        </Tabs.Panel>

        {/* Account Tab */}
        <Tabs.Panel value="account" pt="md">
          <Stack gap="md">
            <Text size="sm" className="ot-text-dim">
              Manage your account settings
            </Text>
            <PasswordInput
              label="Current Password"
              placeholder="Enter current password"
            />
            <PasswordInput
              label="New Password"
              placeholder="Enter new password"
            />
            <PasswordInput
              label="Confirm New Password"
              placeholder="Confirm new password"
            />
            <Button variant="filled" disabled>
              Change Password (Coming Soon)
            </Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
