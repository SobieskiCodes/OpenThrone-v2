'use client';

import { Badge, type BadgeProps } from '@mantine/core';

interface OTBadgeProps extends BadgeProps {
  children: React.ReactNode;
}

export function OTBadge({ children, ...props }: OTBadgeProps) {
  return (
    <Badge variant="light" size="sm" radius="xl" {...props}>
      {children}
    </Badge>
  );
}
