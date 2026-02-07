import { AppShell, Group, Title } from '@mantine/core';

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={3}>OpenThrone</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {/* TODO: Sidebar navigation */}
        <div>Sidebar placeholder</div>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
