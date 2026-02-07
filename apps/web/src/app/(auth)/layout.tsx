import { Container, Center } from '@mantine/core';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Center mih="100vh">
      <Container size="xs" w="100%">
        {children}
      </Container>
    </Center>
  );
}
