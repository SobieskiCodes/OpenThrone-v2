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
  Badge,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useApi } from '@/hooks/use-api';

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
      { label: 'Alliances', href: '/alliances' },
      { label: 'Messaging', href: '/messaging' },
    ],
  },
  { label: 'Community', href: '/community' },
  { label: 'Recruitment', href: '/recruit' },
];

const adminNavItems = [
  {
    label: 'Admin',
    children: [
      { label: 'Dashboard', href: '/admin' },
      { label: 'Players', href: '/admin/players' },
      { label: 'Jobs', href: '/admin/jobs' },
    ],
  },
];

export default function GameLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { api, isReady } = useApi();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['mail', 'unread-count'],
    queryFn: () => api.get('/mail/unread-count'),
    enabled: isReady,
    refetchInterval: 60000,
  });
  const unreadCount = unreadData?.count ?? 0;
  const permissions: string[] = (session as any)?.permissions ?? [];
  const isAdmin = permissions.includes('ADMINISTRATOR');
  const allNavItems = isAdmin ? [...navItems, ...adminNavItems] : navItems;

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
            {allNavItems.map((item) =>
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
                      label={
                        child.href === '/messaging' && unreadCount > 0 ? (
                          <Group gap="xs">
                            <span>{child.label}</span>
                            <Badge size="xs" circle color="red" variant="filled">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </Badge>
                          </Group>
                        ) : (
                          child.label
                        )
                      }
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
