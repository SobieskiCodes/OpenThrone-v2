'use client';

import { Container, Title, Tabs, Stack } from '@mantine/core';
import { useState } from 'react';
import InboxTab from './InboxTab';
import ChatTab from './ChatTab';

export default function MessagingPage() {
  const [tab, setTab] = useState<string | null>('inbox');

  return (
    <Container size="lg">
      <Stack gap="md">
        <Title order={2}>Messaging</Title>
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
      </Stack>
    </Container>
  );
}
