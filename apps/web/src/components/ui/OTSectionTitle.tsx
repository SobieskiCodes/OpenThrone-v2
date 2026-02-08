'use client';

import { Title, Divider, Stack, type TitleOrder } from '@mantine/core';

interface OTSectionTitleProps {
  children: React.ReactNode;
  order?: TitleOrder;
  noDivider?: boolean;
}

export function OTSectionTitle({
  children,
  order = 3,
  noDivider = false,
}: OTSectionTitleProps) {
  return (
    <Stack gap={4}>
      <Title order={order}>{children}</Title>
      {!noDivider && <Divider />}
    </Stack>
  );
}
