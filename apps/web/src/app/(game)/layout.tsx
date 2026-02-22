'use client';

import { useEffect, useRef } from 'react';
import {
  AppShell,
  Group,
  NavLink,
  Stack,
  Text,
  Button,
  ScrollArea,
  Badge,
  Burger,
  Box,
  Tooltip,
  Menu,
  ActionIcon,
  Indicator,
  Avatar,
  Modal,
  Tabs,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useApi } from '@/hooks/use-api';
import { useGameSync } from '@/hooks/use-game-sync';
import { RaceThemeProvider } from '@/context/race-theme';
import { usePlayerStore } from '@/stores/player-store';
import { ChatWidget } from '@/components/chat-widget';
import { SettingsModal } from '@/components/settings';
import {
  IconHome,
  IconShield,
  IconSwords,
  IconBuildingCastle,
  IconWorld,
  IconSettings,
  IconLogout,
  IconMail,
  IconTrophy,
  IconHammer,
  IconUser,
} from '@tabler/icons-react';

const navItems = [
  { label: 'Home', href: '/home', icon: IconHome },
  {
    label: 'Army',
    icon: IconShield,
    children: [
      { label: 'Training', href: '/battle/training' },
      { label: 'Armory', href: '/structures/armory' },
      { label: 'Upgrades', href: '/battle/upgrades' },
      { label: 'Proficiencies', href: '/battle/proficiencies' },
    ],
  },
  {
    label: 'Battle',
    icon: IconSwords,
    children: [
      { label: 'Attack', href: '/battle/players' },
      { label: 'War History', href: '/battle/history' },
    ],
  },
  {
    label: 'Kingdom',
    icon: IconBuildingCastle,
    children: [
      { label: 'Bank', href: '/structures/bank' },
      { label: 'Buildings', href: '/structures/buildings' },
      { label: 'Repair', href: '/structures/repair' },
    ],
  },
  {
    label: 'World',
    icon: IconWorld,
    children: [
      { label: 'Rankings', href: '/world/rankings' },
      { label: 'Activity', href: '/world/activity' },
      { label: 'Alliances', href: '/alliances' },
      { label: 'Messaging', href: '/messaging' },
      { label: 'Recruit', href: '/recruit' },
    ],
  },
];

const adminNavItems = [
  {
    label: 'Admin',
    icon: IconSettings,
    children: [
      { label: 'Dashboard', href: '/admin' },
      { label: 'Players', href: '/admin/players' },
      { label: 'Bots', href: '/admin/bots' },
      { label: 'Jobs', href: '/admin/jobs' },
      { label: 'Combat Sim', href: '/admin/combat-sim' },
      { label: 'Settings', href: '/admin/settings' },
    ],
  },
];

interface MeData {
  id?: string;
  displayName?: string;
  race?: string;
  availablePoints?: number;
  availableUpgrades?: number;
  economy?: {
    gold: string;
    goldInBank: string;
    attackTurns: number;
  };
  stats?: {
    rank: number;
    experience: string; // BigInt as string
  };
  units?: { unitType: string; level: number; quantity: number }[];
  level?: number;
}

interface Building {
  buildingType: string;
  currentLevel: number;
}

interface BuildingsResponse {
  buildings: Building[];
}

function GameShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { api, isReady } = useApi();
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [settingsOpened, { open: openSettings, close: closeSettings }] = useDisclosure();

  // Connect to WebSocket for real-time state sync
  useGameSync();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['mail', 'unread-count'],
    queryFn: () => api.get('/mail/unread-count'),
    enabled: isReady,
    refetchInterval: 60000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const { data: meData } = useQuery<MeData>({
    queryKey: ['player', 'me'],
    queryFn: () => api.get('/player/me'),
    enabled: isReady,
    refetchInterval: 120000,
  });
  const availablePoints = meData?.availablePoints ?? 0;
  const availableUpgrades = meData?.availableUpgrades ?? 0;

  const { data: buildingsData } = useQuery<BuildingsResponse>({
    queryKey: ['structures', 'buildings'],
    queryFn: () => api.get('/structures/buildings'),
    enabled: isReady,
    refetchInterval: 120000,
  });

  // Check if player has mercenary camp
  const hasMercenaryCamp = buildingsData?.buildings?.some(
    (b) => b.buildingType === 'MERCENARY_CAMP' && b.currentLevel > 0
  ) ?? false;

  // ─── Hydrate Zustand Store ──────────────────────────────────────
  useEffect(() => {
    if (meData) {
      // Calculate total units
      const totalUnits = meData.units?.reduce((sum, u) => sum + u.quantity, 0) ?? 0;

      // Build unitsByType map
      const unitsByType = meData.units?.reduce((acc, u) => {
        acc[u.unitType] = u.quantity;
        return acc;
      }, {} as Record<string, number>) ?? {};

      // Build buildings map
      const buildings = buildingsData?.buildings?.reduce((acc, b) => {
        acc[b.buildingType] = b.currentLevel;
        return acc;
      }, {} as Record<string, number>) ?? {};

      // Hydrate store (gold stored as strings)
      usePlayerStore.getState().setState({
        id: meData.id ?? '',
        displayName: meData.displayName ?? '',
        level: meData.level ?? 1,
        experience: meData.stats?.experience ?? '0',
        race: meData.race ?? 'UNDEAD',
        gold: meData.economy?.gold ?? '0',
        goldInBank: meData.economy?.goldInBank ?? '0',
        attackTurns: meData.economy?.attackTurns ?? 0,
        totalUnits,
        unitsByType,
        buildings,
        availablePoints: meData.availablePoints ?? 0,
        availableUpgrades: meData.availableUpgrades ?? 0,
        unreadMail: unreadCount,
        proficiencies: {}, // TODO: add when proficiencies are in meData
        equippedItems: [], // TODO: add when equipped items are in meData
      });
    }
  }, [meData, buildingsData, unreadCount]);

  // ─── Notification Handlers ───────────────────────────────────────
  const notificationsShown = useRef(false);
  const lastLevel = useRef(0);
  const lastAvailablePoints = useRef<number | null>(null);
  const lastAvailableUpgrades = useRef<number | null>(null);
  const lastUnreadMail = useRef<number | null>(null);

  // Initial notifications on login
  useEffect(() => {
    if (notificationsShown.current || !meData) return;

    const unreadMail = usePlayerStore.getState().unreadMail;
    const availablePoints = usePlayerStore.getState().availablePoints;
    const availableUpgrades = usePlayerStore.getState().availableUpgrades;

    if (unreadMail > 0) {
      notifications.show({
        id: 'unread-mail',
        title: 'Unread Messages',
        message: `You have ${unreadMail} unread message${unreadMail > 1 ? 's' : ''}`,
        color: 'blue',
        icon: <IconMail size={20} />,
        autoClose: 5000,
      });
    }

    if (availablePoints > 0) {
      notifications.show({
        id: 'available-points',
        title: 'Proficiency Points Available',
        message: `You have ${availablePoints} proficiency point${availablePoints > 1 ? 's' : ''} to spend`,
        color: 'green',
        icon: <IconTrophy size={20} />,
        autoClose: 5000,
      });
    }

    if (availableUpgrades > 0) {
      notifications.show({
        id: 'available-upgrades',
        title: 'Building Upgrades Available',
        message: `You have ${availableUpgrades} building upgrade${availableUpgrades > 1 ? 's' : ''} available`,
        color: 'yellow',
        icon: <IconHammer size={20} />,
        autoClose: 5000,
      });
    }

    notificationsShown.current = true;
  }, [meData]);

  // Watch for real-time state changes and show notifications
  useEffect(() => {
    const unsubscribe = usePlayerStore.subscribe((state) => {
      // Track level changes
      if (lastLevel.current > 0 && state.level > lastLevel.current) {
        notifications.show({
          id: 'level-up',
          title: `🎉 Level Up!`,
          message: `You reached level ${state.level}!`,
          color: 'green',
          autoClose: 8000,
        });
      }
      lastLevel.current = state.level;

      // Track proficiency points (notify if increased, including 0 → 1)
      if (lastAvailablePoints.current !== null && state.availablePoints > lastAvailablePoints.current) {
        notifications.show({
          id: 'new-proficiency-points',
          title: 'Proficiency Points Earned',
          message: `You have ${state.availablePoints} proficiency point${state.availablePoints > 1 ? 's' : ''} to spend`,
          color: 'green',
          icon: <IconTrophy size={20} />,
          autoClose: 5000,
        });
      }
      lastAvailablePoints.current = state.availablePoints;

      // Track building upgrades (notify if increased, including 0 → 1)
      if (lastAvailableUpgrades.current !== null && state.availableUpgrades > lastAvailableUpgrades.current) {
        notifications.show({
          id: 'new-building-upgrades',
          title: 'Building Upgrades Available',
          message: `You have ${state.availableUpgrades} building upgrade${state.availableUpgrades > 1 ? 's' : ''} available`,
          color: 'yellow',
          icon: <IconHammer size={20} />,
          autoClose: 5000,
        });
      }
      lastAvailableUpgrades.current = state.availableUpgrades;

      // Track unread mail (notify if increased, including 0 → 1)
      if (lastUnreadMail.current !== null && state.unreadMail > lastUnreadMail.current) {
        notifications.show({
          id: 'new-mail',
          title: 'New Message',
          message: `You have ${state.unreadMail} unread message${state.unreadMail > 1 ? 's' : ''}`,
          color: 'blue',
          icon: <IconMail size={20} />,
          autoClose: 5000,
        });
      }
      lastUnreadMail.current = state.unreadMail;
    });

    return () => unsubscribe();
  }, []);

  const permissions: string[] = (session as any)?.permissions ?? [];
  const isAdmin = permissions.includes('ADMINISTRATOR');

  // Build nav items dynamically based on player state
  const dynamicNavItems = navItems.map(item => {
    if (item.label === 'Army' && item.children) {
      return {
        ...item,
        children: [
          ...item.children,
          ...(hasMercenaryCamp ? [{ label: 'Mercenaries', href: '/structures/mercenary' }] : [])
        ]
      };
    }
    return item;
  });

  const allNavItems = isAdmin ? [...dynamicNavItems, ...adminNavItems] : dynamicNavItems;

  // Badge counts keyed by child href - read from Zustand store for instant updates
  const storeUnreadMail = usePlayerStore((state) => state.unreadMail);
  const storeAvailablePoints = usePlayerStore((state) => state.availablePoints);
  const storeAvailableUpgrades = usePlayerStore((state) => state.availableUpgrades);

  const badgeCounts: Record<string, number> = {};
  if (storeUnreadMail > 0) badgeCounts['/messaging'] = storeUnreadMail;
  if (storeAvailablePoints > 0) badgeCounts['/battle/proficiencies'] = storeAvailablePoints;
  if (storeAvailableUpgrades > 0) badgeCounts['/structures/buildings'] = storeAvailableUpgrades;

  const handleLogout = async () => {
    // Reset Zustand store on logout
    usePlayerStore.getState().reset();
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <AppShell
      navbar={{ width: { base: 260, sm: 60 }, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }}
      padding={0}
      styles={{ navbar: { top: 0, height: '100dvh' } }}
    >
      <Burger
        opened={mobileOpened}
        onClick={toggleMobile}
        hiddenFrom="sm"
        size="sm"
        color="var(--ot-text-dim)"
        style={{ position: 'fixed', top: 10, left: 10, zIndex: 250 }}
        aria-label="Toggle navigation"
      />

      {/* ── Sidebar ─────────────────────────────────────── */}
      <AppShell.Navbar className="ot-navbar" p={{ base: 'xs', sm: 4 }}>
        {/* ── Mobile: Full sidebar (burger toggle) ── */}
        <Stack hiddenFrom="sm" gap={0} h="100%">
          <ScrollArea style={{ flex: 1 }} scrollbarSize={6}>
            <Stack gap={2}>
              {allNavItems.map((item) => {
                if (!item.children) {
                  return (
                    <NavLink
                      key={item.href}
                      label={item.label}
                      leftSection={<item.icon size={18} />}
                      component={Link}
                      href={item.href}
                      active={pathname === item.href}
                      className="ot-nav-link"
                      onClick={() => toggleMobile()}
                    />
                  );
                }
                const parentTotal = item.children.reduce(
                  (sum, child) => sum + (badgeCounts[child.href] ?? 0),
                  0,
                );
                return (
                  <NavLink
                    key={item.label}
                    leftSection={<item.icon size={18} />}
                    label={
                      parentTotal > 0 ? (
                        <Group gap="xs">
                          <span>{item.label}</span>
                          <Badge size="xs" circle color="red" variant="filled" className="ot-badge-pulse">
                            {parentTotal > 99 ? '99+' : parentTotal}
                          </Badge>
                        </Group>
                      ) : (
                        item.label
                      )
                    }
                    defaultOpened={item.children.some((child) => pathname === child.href)}
                    childrenOffset={28}
                    className="ot-nav-parent"
                    styles={{ children: { padding: 0 } }}
                  >
                    {item.children.map((child) => {
                      const count = badgeCounts[child.href] ?? 0;
                      return (
                        <NavLink
                          key={child.href}
                          label={
                            count > 0 ? (
                              <Group gap="xs">
                                <span>{child.label}</span>
                                <Badge size="xs" circle color="red" variant="filled" className="ot-badge-pulse">
                                  {count > 99 ? '99+' : count}
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
                );
              })}
            </Stack>
          </ScrollArea>
          <Box className="ot-divider" mt="xs" mb="xs" />

          {/* User Menu */}
          <Menu position="top" withArrow>
            <Menu.Target>
              <Group
                gap="sm"
                p="xs"
                style={{
                  cursor: 'pointer',
                  borderRadius: 'var(--mantine-radius-md)',
                  transition: 'background-color 0.2s',
                }}
                className="ot-hover-bg"
              >
                <Avatar
                  size="md"
                  radius="xl"
                  color="var(--ot-color-primary)"
                  style={{ flexShrink: 0 }}
                >
                  {session?.user?.name?.charAt(0).toUpperCase() ?? 'U'}
                </Avatar>
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={600} truncate>
                    {session?.user?.name ?? 'User'}
                  </Text>
                  <Text size="xs" className="ot-text-dim" truncate>
                    {session?.user?.email ?? ''}
                  </Text>
                </Stack>
              </Group>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconUser size={16} />}
                component={Link}
                href={`/profile/${(session as any)?.user?.id}`}
                onClick={() => toggleMobile()}
              >
                View My Profile
              </Menu.Item>
              <Menu.Item
                leftSection={<IconSettings size={16} />}
                onClick={() => {
                  openSettings();
                  toggleMobile();
                }}
              >
                Settings
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconLogout size={16} />}
                color="red"
                onClick={handleLogout}
              >
                Logout
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Text
            size="xs"
            ta="center"
            className="ot-text-dim"
            mt={4}
            component="a"
            href={`https://github.com/SobieskiCodes/OpenThrone-v2/commit/${process.env.NEXT_PUBLIC_BUILD_VERSION}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            v:{process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'dev'}
          </Text>
        </Stack>

        {/* ── Desktop: Icon rail with hover flyouts ── */}
        <Stack visibleFrom="sm" gap={8} align="center" h="100%" py="xs">
          <Stack gap={8} align="center" style={{ flex: 1 }}>
            {allNavItems.map((item) => {
              const Icon = item.icon;

              if (!item.children) {
                return (
                  <Tooltip key={item.href} label={item.label} position="right" withArrow>
                    <ActionIcon
                      component={Link}
                      href={item.href!}
                      variant={pathname === item.href ? 'light' : 'subtle'}
                      color={pathname === item.href ? 'ot' : undefined}
                      size="xl"
                      className="ot-text-dim"
                    >
                      <Icon size={22} />
                    </ActionIcon>
                  </Tooltip>
                );
              }

              const isActive = item.children.some((c) => pathname === c.href);
              const totalBadge = item.children.reduce(
                (sum, child) => sum + (badgeCounts[child.href] ?? 0),
                0,
              );

              return (
                <Menu key={item.label} trigger="hover" position="right-start" offset={8} withArrow>
                  <Menu.Target>
                    <Indicator disabled={totalBadge === 0} color="red" size={8} offset={4}>
                      <ActionIcon
                        variant={isActive ? 'light' : 'subtle'}
                        color={isActive ? 'ot' : undefined}
                        size="xl"
                        className="ot-text-dim"
                      >
                        <Icon size={22} />
                      </ActionIcon>
                    </Indicator>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>{item.label}</Menu.Label>
                    {item.children.map((child) => {
                      const count = badgeCounts[child.href] ?? 0;
                      return (
                        <Menu.Item
                          key={child.href}
                          component={Link}
                          href={child.href}
                          fw={pathname === child.href ? 600 : undefined}
                          color={pathname === child.href ? 'var(--ot-accent)' : undefined}
                          rightSection={
                            count > 0 ? (
                              <Badge size="xs" circle color="red" variant="filled">
                                {count > 99 ? '99+' : count}
                              </Badge>
                            ) : undefined
                          }
                        >
                          {child.label}
                        </Menu.Item>
                      );
                    })}
                  </Menu.Dropdown>
                </Menu>
              );
            })}
          </Stack>

          {/* User Avatar Menu */}
          <Menu position="right" withArrow>
            <Menu.Target>
              <Tooltip label={session?.user?.name ?? 'User'} position="right" withArrow>
                <Avatar
                  size="lg"
                  radius="xl"
                  color="var(--ot-color-primary)"
                  style={{ cursor: 'pointer' }}
                >
                  {session?.user?.name?.charAt(0).toUpperCase() ?? 'U'}
                </Avatar>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{session?.user?.name ?? 'User'}</Menu.Label>
              <Menu.Item
                leftSection={<IconUser size={16} />}
                component={Link}
                href={`/profile/${(session as any)?.user?.id}`}
              >
                View My Profile
              </Menu.Item>
              <Menu.Item
                leftSection={<IconSettings size={16} />}
                onClick={openSettings}
              >
                Settings
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconLogout size={16} />}
                color="red"
                onClick={handleLogout}
              >
                Logout
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Text
            size="9px"
            className="ot-text-dim"
            ta="center"
            component="a"
            href={`https://github.com/SobieskiCodes/OpenThrone-v2/commit/${process.env.NEXT_PUBLIC_BUILD_VERSION}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            v:{process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'dev'}
          </Text>
        </Stack>
      </AppShell.Navbar>

      {/* ── Display Area ─────────────────────────────────── */}
      <AppShell.Main>
        <div className="ot-display" style={{ marginTop: 0, height: '100dvh', overflow: 'auto' }}>
          {children}
        </div>
      </AppShell.Main>

      {/* ── Chat Widget ─────────────────────────────────── */}
      <ChatWidget />

      {/* ── Settings Modal ──────────────────────────────── */}
      <SettingsModal opened={settingsOpened} onClose={closeSettings} />
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
