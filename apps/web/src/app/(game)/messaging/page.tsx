'use client';

import { Container, Stack, Text, Title } from '@mantine/core';
import InboxTab from './InboxTab';
import { OTCard } from '@/components/ui';


export default function MessagingPage() {
  return (
    <Container size="lg">
      <Stack gap="md">
        <Title order={2}>Mail</Title>

        <OTCard p="md">
          <Text size="sm" className="ot-text-dim" mb="sm">
            Your inbox for direct correspondence with other players.
          </Text>

          <InboxTab />
        </OTCard>
      </Stack>
    </Container>
  );
}
