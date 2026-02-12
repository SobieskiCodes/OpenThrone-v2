'use client';

import { Container, Tabs, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import InboxTab from './InboxTab';
import ChatTab from './ChatTab';
import { OTCard } from '@/components/ui';


export default function MessagingPage() {
  const [tab, setTab] = useState<string | null>('inbox');

  return (
    <Container size="lg">
      <Stack gap="md">
        <Title order={2}>Messaging</Title>

        <OTCard p="md">
          <Text size="sm" className="ot-text-dim" mb="sm">
            Your inbox tracks direct correspondence while chat gives you a live coordination channel.
          </Text>

          <Tabs value={tab} onChange={setTab}>
            <Tabs.List>
              <Tabs.Tab value="inbox">Inbox</Tabs.Tab>
              <Tabs.Tab value="chat">Chat</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="inbox" pt="md">
              <InboxTab />
            </Tabs.Panel>

            <Tabs.Panel value="chat" pt="md">
              <ChatTab />
            </Tabs.Panel>
          </Tabs>
        </OTCard>
      </Stack>
    </Container>
  );
}
