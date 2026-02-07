import { Title, Text, Container, Stack, Button, Group } from '@mantine/core';
import Link from 'next/link';

export default function HomePage() {
  return (
    <Container size="md" py="xl">
      <Stack align="center" gap="lg">
        <Title order={1}>OpenThrone</Title>
        <Text size="lg" c="dimmed" ta="center">
          A text-based MMORPG. Build your kingdom, train your army, conquer your enemies.
        </Text>
        <Group>
          <Button component={Link} href="/login" variant="filled">
            Login
          </Button>
          <Button component={Link} href="/register" variant="outline">
            Register
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
