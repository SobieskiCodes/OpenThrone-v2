import { Container } from '@mantine/core';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ot-auth-container">
      <Container size="xs" w="100%">
        {children}
      </Container>
    </div>
  );
}
