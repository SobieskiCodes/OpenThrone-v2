'use client';

import { Paper, type PaperProps } from '@mantine/core';

interface OTCardProps extends PaperProps {
  children: React.ReactNode;
  hoverable?: boolean;
}

export function OTCard({ children, hoverable = false, ...props }: OTCardProps) {
  return (
    <Paper
      shadow="sm"
      radius="lg"
      p="lg"
      withBorder
      style={{
        ...(hoverable
          ? {
              cursor: 'pointer',
              transition: 'border-color 180ms ease, box-shadow 180ms ease',
            }
          : {}),
        ...((props.style as Record<string, unknown>) ?? {}),
      }}
      {...props}
    >
      {children}
    </Paper>
  );
}
