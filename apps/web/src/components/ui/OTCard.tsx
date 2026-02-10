'use client';

import { Paper, type PaperProps } from '@mantine/core';

interface OTCardProps extends PaperProps {
  children: React.ReactNode;
  hoverable?: boolean;
  header?: React.ReactNode;
  accent?: boolean;
  featured?: boolean;
}

export function OTCard({
  children,
  hoverable = false,
  header,
  accent = false,
  featured = false,
  className,
  ...props
}: OTCardProps) {
  const classes = [
    className,
    accent ? 'ot-race-accent' : '',
    featured ? 'ot-card-featured' : '',
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <Paper
      shadow="sm"
      radius="lg"
      p="lg"
      withBorder
      className={classes}
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
      {header && <div className="ot-card-header">{header}</div>}
      {children}
    </Paper>
  );
}
