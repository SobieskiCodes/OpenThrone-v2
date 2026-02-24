'use client';

import {
  Title,
  Stack,
  Tabs,
  Table,
  Button,
  Group,
  Loader,
  Center,
  Badge,
  Text,
  Paper,
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { notifications } from '@mantine/notifications';

export default function GameDataPage() {
  const { api, isReady } = useApi();
  const queryClient = useQueryClient();

  const { data: units, isLoading: unitsLoading } = useQuery({
    queryKey: ['admin', 'game-data', 'units'],
    queryFn: () => api.get('/admin/game-data/units'),
    enabled: isReady,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['admin', 'game-data', 'items'],
    queryFn: () => api.get('/admin/game-data/items'),
    enabled: isReady,
  });

  const { data: buildings, isLoading: buildingsLoading } = useQuery({
    queryKey: ['admin', 'game-data', 'buildings'],
    queryFn: () => api.get('/admin/game-data/buildings'),
    enabled: isReady,
  });

  const { data: fortifications, isLoading: fortsLoading } = useQuery({
    queryKey: ['admin', 'game-data', 'fortifications'],
    queryFn: () => api.get('/admin/game-data/fortifications'),
    enabled: isReady,
  });

  const { data: battleUpgrades, isLoading: battleUpgradesLoading } = useQuery({
    queryKey: ['admin', 'game-data', 'battle-upgrades'],
    queryFn: () => api.get('/admin/game-data/battle-upgrades'),
    enabled: isReady,
  });

  const { data: economyUpgrades, isLoading: economyUpgradesLoading } = useQuery({
    queryKey: ['admin', 'game-data', 'economy-upgrades'],
    queryFn: () => api.get('/admin/game-data/economy-upgrades'),
    enabled: isReady,
  });

  const { data: races, isLoading: racesLoading } = useQuery({
    queryKey: ['admin', 'game-data', 'races'],
    queryFn: () => api.get('/admin/game-data/races'),
    enabled: isReady,
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['admin', 'game-data', 'config'],
    queryFn: () => api.get('/admin/game-data/config'),
    enabled: isReady,
  });

  const reloadMutation = useMutation({
    mutationFn: () => api.post('/admin/game-data/reload'),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'game-data'] });
      notifications.show({
        title: 'Game Data Reloaded',
        message: data.message,
        color: 'green',
      });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Error',
        message: err.message,
        color: 'red',
      });
    },
  });

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Game Data Management</Title>
        <Button
          onClick={() => reloadMutation.mutate()}
          loading={reloadMutation.isPending}
          color="blue"
        >
          🔄 Hot Reload
        </Button>
      </Group>

      <Paper p="md" withBorder>
        <Text size="sm" c="dimmed">
          View and manage all database-backed game definitions. Click "Hot Reload" to refresh
          the in-memory cache after making database changes.
        </Text>
      </Paper>

      <Tabs defaultValue="units">
        <Tabs.List>
          <Tabs.Tab value="units">Units ({units?.total ?? 0})</Tabs.Tab>
          <Tabs.Tab value="items">Items ({items?.total ?? 0})</Tabs.Tab>
          <Tabs.Tab value="buildings">Buildings ({buildings?.total ?? 0})</Tabs.Tab>
          <Tabs.Tab value="fortifications">Fortifications ({fortifications?.total ?? 0})</Tabs.Tab>
          <Tabs.Tab value="battle-upgrades">Battle Upgrades ({battleUpgrades?.total ?? 0})</Tabs.Tab>
          <Tabs.Tab value="economy-upgrades">Economy Upgrades ({economyUpgrades?.total ?? 0})</Tabs.Tab>
          <Tabs.Tab value="races">Races ({races?.total ?? 0})</Tabs.Tab>
          <Tabs.Tab value="config">Config ({config?.total ?? 0})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="units" pt="md">
          {unitsLoading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Level</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Cost</Table.Th>
                  <Table.Th>Bonus</Table.Th>
                  <Table.Th>HP</Table.Th>
                  <Table.Th>Fort Level</Table.Th>
                  <Table.Th>Enabled</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {units?.data?.map((unit: any) => (
                  <Table.Tr key={unit.id}>
                    <Table.Td>{unit.type}</Table.Td>
                    <Table.Td>{unit.level}</Table.Td>
                    <Table.Td>{unit.name}</Table.Td>
                    <Table.Td>{BigInt(unit.cost).toLocaleString()}</Table.Td>
                    <Table.Td>{unit.bonus}</Table.Td>
                    <Table.Td>{unit.hp}</Table.Td>
                    <Table.Td>{unit.fort_level}</Table.Td>
                    <Table.Td>
                      <Badge color={unit.enabled ? 'green' : 'red'} size="sm">
                        {unit.enabled ? 'Yes' : 'No'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="items" pt="md">
          {itemsLoading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Usage</Table.Th>
                  <Table.Th>Level</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Cost</Table.Th>
                  <Table.Th>Bonus</Table.Th>
                  <Table.Th>Race</Table.Th>
                  <Table.Th>Enabled</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items?.data?.map((item: any) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>{item.type}</Table.Td>
                    <Table.Td>{item.usage}</Table.Td>
                    <Table.Td>{item.level}</Table.Td>
                    <Table.Td>{item.name}</Table.Td>
                    <Table.Td>{BigInt(item.cost).toLocaleString()}</Table.Td>
                    <Table.Td>{item.bonus}</Table.Td>
                    <Table.Td>{item.race}</Table.Td>
                    <Table.Td>
                      <Badge color={item.enabled ? 'green' : 'red'} size="sm">
                        {item.enabled ? 'Yes' : 'No'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="buildings" pt="md">
          {buildingsLoading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Level</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Cost</Table.Th>
                  <Table.Th>Player Level</Table.Th>
                  <Table.Th>Workers</Table.Th>
                  <Table.Th>Enabled</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {buildings?.data?.map((building: any) => (
                  <Table.Tr key={building.id}>
                    <Table.Td>{building.type}</Table.Td>
                    <Table.Td>{building.level}</Table.Td>
                    <Table.Td>{building.name}</Table.Td>
                    <Table.Td>{BigInt(building.cost).toLocaleString()}</Table.Td>
                    <Table.Td>{building.player_level_req}</Table.Td>
                    <Table.Td>{building.workers_provided ?? '-'}</Table.Td>
                    <Table.Td>
                      <Badge color={building.enabled ? 'green' : 'red'} size="sm">
                        {building.enabled ? 'Yes' : 'No'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="fortifications" pt="md">
          {fortsLoading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Level</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Cost</Table.Th>
                  <Table.Th>Hitpoints</Table.Th>
                  <Table.Th>Gold/Turn</Table.Th>
                  <Table.Th>Defense Bonus</Table.Th>
                  <Table.Th>Enabled</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {fortifications?.data?.map((fort: any) => (
                  <Table.Tr key={fort.id}>
                    <Table.Td>{fort.level}</Table.Td>
                    <Table.Td>{fort.name}</Table.Td>
                    <Table.Td>{BigInt(fort.cost).toLocaleString()}</Table.Td>
                    <Table.Td>{fort.hitpoints}</Table.Td>
                    <Table.Td>{fort.gold_per_turn}</Table.Td>
                    <Table.Td>{fort.defense_bonus_percentage}%</Table.Td>
                    <Table.Td>
                      <Badge color={fort.enabled ? 'green' : 'red'} size="sm">
                        {fort.enabled ? 'Yes' : 'No'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="battle-upgrades" pt="md">
          {battleUpgradesLoading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Level</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Cost</Table.Th>
                  <Table.Th>Bonus</Table.Th>
                  <Table.Th>Units Covered</Table.Th>
                  <Table.Th>Enabled</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {battleUpgrades?.data?.map((upgrade: any) => (
                  <Table.Tr key={upgrade.id}>
                    <Table.Td>{upgrade.type}</Table.Td>
                    <Table.Td>{upgrade.level}</Table.Td>
                    <Table.Td>{upgrade.name}</Table.Td>
                    <Table.Td>{BigInt(upgrade.cost).toLocaleString()}</Table.Td>
                    <Table.Td>{upgrade.bonus}</Table.Td>
                    <Table.Td>{upgrade.units_covered}</Table.Td>
                    <Table.Td>
                      <Badge color={upgrade.enabled ? 'green' : 'red'} size="sm">
                        {upgrade.enabled ? 'Yes' : 'No'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="economy-upgrades" pt="md">
          {economyUpgradesLoading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Level</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Cost</Table.Th>
                  <Table.Th>Gold/Worker</Table.Th>
                  <Table.Th>Fort Level</Table.Th>
                  <Table.Th>Enabled</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {economyUpgrades?.data?.map((upgrade: any) => (
                  <Table.Tr key={upgrade.id}>
                    <Table.Td>{upgrade.level}</Table.Td>
                    <Table.Td>{upgrade.name}</Table.Td>
                    <Table.Td>{BigInt(upgrade.cost).toLocaleString()}</Table.Td>
                    <Table.Td>{upgrade.gold_per_worker}</Table.Td>
                    <Table.Td>{upgrade.fort_level}</Table.Td>
                    <Table.Td>
                      <Badge color={upgrade.enabled ? 'green' : 'red'} size="sm">
                        {upgrade.enabled ? 'Yes' : 'No'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="races" pt="md">
          {racesLoading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>ID</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Offense</Table.Th>
                  <Table.Th>Defense</Table.Th>
                  <Table.Th>Spy</Table.Th>
                  <Table.Th>Sentry</Table.Th>
                  <Table.Th>Income</Table.Th>
                  <Table.Th>Enabled</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {races?.data?.map((race: any) => (
                  <Table.Tr key={race.id}>
                    <Table.Td>{race.id}</Table.Td>
                    <Table.Td>{race.name}</Table.Td>
                    <Table.Td>{(race.offense_bonus * 100).toFixed(0)}%</Table.Td>
                    <Table.Td>{(race.defense_bonus * 100).toFixed(0)}%</Table.Td>
                    <Table.Td>{(race.spy_bonus * 100).toFixed(0)}%</Table.Td>
                    <Table.Td>{(race.sentry_bonus * 100).toFixed(0)}%</Table.Td>
                    <Table.Td>{(race.income_bonus * 100).toFixed(0)}%</Table.Td>
                    <Table.Td>
                      <Badge color={race.enabled ? 'green' : 'red'} size="sm">
                        {race.enabled ? 'Yes' : 'No'}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="config" pt="md">
          {configLoading ? (
            <Center h={200}>
              <Loader />
            </Center>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Key</Table.Th>
                  <Table.Th>Value</Table.Th>
                  <Table.Th>Description</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {config?.data?.map((cfg: any) => (
                  <Table.Tr key={cfg.key}>
                    <Table.Td>
                      <Text fw={600}>{cfg.key}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="lg">{cfg.value}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {cfg.description}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
