'use client';

import {
  AppShell,
  Group,
  Title,
  NavLink,
  Stack,
  Text,
  Button,
  Divider,
  ScrollArea,
  ActionIcon,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

const navItems = [
  { label: 'Home', href: '/home' },
  {
    label: 'Battle',
    children: [
      { label: 'Training', href: '/battle/training' },
      { label: 'Upgrades', href: '/battle/upgrades' },
      { label: 'Players', href: '/battle/players' },
      { label: 'History', href: '/battle/history' },
    ],
  },
  {
    label: 'Structures',
    children: [
      { label: 'Bank', href: '/structures/bank' },
      { label: 'Armory', href: '/structures/armory' },
      { label: 'Housing', href: '/structures/housing' },
      { label: 'Upgrades', href: '/structures/upgrades' },
      { label: 'Repair', href: '/structures/repair' },
    ],
  },
  {
    label: 'Social',
    children: [
      { label: 'Social', href: '/social' },
      { label: 'Alliances', href: '/social/alliances' },
      { label: 'Messaging', href: '/social/messaging' },
    ],
  },
  { label: 'Community', href: '/community' },
  { label: 'Recruitment', href: '/recruit' },
];

export default function GameLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');

  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>OpenThrone</Title>
          <Group gap="sm">
            {session?.user?.name && (
              <Text size="sm" c="dimmed">
                Welcome, {session.user.name}
              </Text>
            )}
            <ActionIcon
              variant="default"
              size="lg"
              onClick={toggleColorScheme}
              aria-label="Toggle color scheme"
            >
              {computedColorScheme === 'dark' ? '\u2600' : '\u263E'}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <AppShell.Section>
          {session?.user?.name && (
            <Stack gap={4} p="xs" mb="xs">
              <Text fw={600} size="sm">
                {session.user.name}
              </Text>
              <Text size="xs" c="dimmed">
                {session.user.email}
              </Text>
            </Stack>
          )}
          <Divider mb="xs" />
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={0}>
            {navItems.map((item) =>
              item.children ? (
                <NavLink
                  key={item.label}
                  label={item.label}
                  defaultOpened={item.children.some((child) => pathname === child.href)}
                  childrenOffset={16}
                >
                  {item.children.map((child) => (
                    <NavLink
                      key={child.href}
                      label={child.label}
                      component={Link}
                      href={child.href}
                      active={pathname === child.href}
                    />
                  ))}
                </NavLink>
              ) : (
                <NavLink
                  key={item.href}
                  label={item.label}
                  component={Link}
                  href={item.href}
                  active={pathname === item.href}
                />
              ),
            )}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Divider mt="xs" mb="xs" />
          <Button
            variant="subtle"
            color="red"
            fullWidth
            onClick={handleLogout}
          >
            Logout
          </Button>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
