import { Title, Text, Container } from '@mantine/core';

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Container>
      <Title order={2}>Player Profile</Title>
      <Text c="dimmed">Coming soon. Player ID: {id}</Text>
    </Container>
  );
}
