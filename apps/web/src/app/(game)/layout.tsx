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
  Burger,
  Box,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useApi } from '@/hooks/use-api';
import { RaceThemeProvider, useRaceTheme } from '@/context/race-theme';

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

function GameShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { api, isReady } = useApi();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');
  const { race, colorName } = useRaceTheme();
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();

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
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }}
      padding="md"
    >
      {/* ── Header ──────────────────────────────────────── */}
      <AppShell.Header className="ot-header" style={{ position: 'relative' }}>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
              color="var(--ot-gold-muted)"
            />
            <Title
              order={3}
              style={{
                color: 'var(--ot-gold)',
                letterSpacing: '0.02em',
                cursor: 'pointer',
              }}
              onClick={() => router.push('/home')}
            >
              OpenThrone
            </Title>
          </Group>
          <Group gap="sm">
            {session?.user?.name && (
              <Text
                size="sm"
                style={{ color: 'var(--ot-text-dim)' }}
                visibleFrom="xs"
              >
                {session.user.name}
              </Text>
            )}
            <Badge
              size="sm"
              variant="light"
              color={colorName}
              style={{ textTransform: 'capitalize' }}
            >
              {race}
            </Badge>
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={toggleColorScheme}
              aria-label="Toggle color scheme"
              style={{ color: 'var(--ot-gold-dim)' }}
            >
              {computedColorScheme === 'dark' ? '\u2600' : '\u263E'}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <AppShell.Navbar className="ot-navbar" p="xs">
        {/* Player info section (mobile) */}
        <AppShell.Section>
          {session?.user?.name && (
            <Stack gap={4} p="xs" mb={4}>
              <Text fw={600} size="sm" style={{ color: 'var(--ot-gold)' }}>
                {session.user.name}
              </Text>
              <Text size="xs" style={{ color: 'var(--ot-text-dim)' }}>
                {session.user.email}
              </Text>
            </Stack>
          )}
          <Box className="ot-divider" mb="xs" />
        </AppShell.Section>

        {/* Navigation */}
        <AppShell.Section grow component={ScrollArea} scrollbarSize={6}>
          <Stack gap={2}>
            {allNavItems.map((item) =>
              item.children ? (
                <NavLink
                  key={item.label}
                  label={item.label}
                  defaultOpened={item.children.some((child) => pathname === child.href)}
                  childrenOffset={16}
                  className="ot-nav-parent"
                  styles={{
                    children: { padding: 0 },
                  }}
                >
                  {item.children.map((child) => (
                    <NavLink
                      key={child.href}
                      label={
                        child.href === '/messaging' && unreadCount > 0 ? (
                          <Group gap="xs">
                            <span>{child.label}</span>
                            <Badge
                              size="xs"
                              circle
                              color="red"
                              variant="filled"
                              className="ot-badge-pulse"
                            >
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
                      className="ot-nav-link"
                      onClick={() => toggleMobile()}
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
                  className="ot-nav-link"
                  onClick={() => toggleMobile()}
                />
              ),
            )}
          </Stack>
        </AppShell.Section>

        {/* Logout */}
        <AppShell.Section>
          <Box className="ot-divider" mt="xs" mb="xs" />
          <Button
            variant="subtle"
            fullWidth
            onClick={handleLogout}
            style={{
              color: 'var(--ot-danger)',
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            Logout
          </Button>
        </AppShell.Section>
      </AppShell.Navbar>

      {/* ── Main Content ────────────────────────────────── */}
      <AppShell.Main>
        <div className="ot-page-content">{children}</div>
      </AppShell.Main>
    </AppShell>
  );
}

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <RaceThemeProvider>
      <GameShell>{children}</GameShell>
    </RaceThemeProvider>
  );
}
