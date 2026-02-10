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
    label: 'Army',
    children: [
      { label: 'Training', href: '/battle/training' },
      { label: 'Armory', href: '/structures/armory' },
      { label: 'Upgrades', href: '/battle/upgrades' },
      { label: 'Proficiencies', href: '/battle/proficiencies' },
    ],
  },
  {
    label: 'Battle',
    children: [
      { label: 'Attack', href: '/battle/players' },
      { label: 'War History', href: '/battle/history' },
    ],
  },
  {
    label: 'Kingdom',
    children: [
      { label: 'Bank', href: '/structures/bank' },
      { label: 'Buildings', href: '/structures/upgrades' },
      { label: 'Repair', href: '/structures/repair' },
    ],
  },
  {
    label: 'World',
    children: [
      { label: 'Rankings', href: '/world/rankings' },
      { label: 'Alliances', href: '/alliances' },
      { label: 'Messaging', href: '/messaging' },
      { label: 'Recruit', href: '/recruit' },
    ],
  },
];

const adminNavItems = [
  {
    label: 'Admin',
    children: [
      { label: 'Dashboard', href: '/admin' },
      { label: 'Players', href: '/admin/players' },
      { label: 'Jobs', href: '/admin/jobs' },
      { label: 'Combat Sim', href: '/admin/combat-sim' },
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

  const { data: meData } = useQuery<{ availablePoints?: number }>({
    queryKey: ['player', 'me'],
    queryFn: () => api.get('/player/me'),
    enabled: isReady,
    refetchInterval: 120000,
  });
  const availablePoints = meData?.availablePoints ?? 0;
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
              color="var(--ot-text-dim)"
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
                component={Link}
                href={`/profile/${(session as any).user.id}`}
                size="sm"
                style={{ color: 'var(--ot-text-dim)', textDecoration: 'none' }}
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
              style={{ color: 'var(--ot-text-dim)' }}
            >
              {computedColorScheme === 'dark' ? '\u2600' : '\u263E'}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <AppShell.Navbar className="ot-navbar" p="xs">
        {/* Player info section */}
        <AppShell.Section>
          {session?.user?.name && (
            <Stack gap={4} p="xs" mb={4}>
              <Text
                component={Link}
                href={`/profile/${(session as any).user.id}`}
                fw={600}
                size="sm"
                style={{ color: 'var(--ot-gold)', textDecoration: 'none' }}
              >
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
                  {item.children.map((child) => {
                    const badgeCount =
                      child.href === '/messaging' ? unreadCount
                      : child.href === '/battle/proficiencies' ? availablePoints
                      : 0;

                    return (
                      <NavLink
                        key={child.href}
                        label={
                          badgeCount > 0 ? (
                            <Group gap="xs">
                              <span>{child.label}</span>
                              <Badge
                                size="xs"
                                circle
                                color={child.href === '/battle/proficiencies' ? 'green' : 'red'}
                                variant="filled"
                                className="ot-badge-pulse"
                              >
                                {badgeCount > 99 ? '99+' : badgeCount}
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
                    );
                  })}
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
            color="red"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </AppShell.Section>
      </AppShell.Navbar>

      {/* ── Main Content ────────────────────────────────── */}
      <AppShell.Main>
        <div className="ot-page-content" style={{ maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </div>
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
