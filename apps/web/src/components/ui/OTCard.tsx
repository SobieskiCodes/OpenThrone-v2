'use client';

import { Paper, type PaperProps, type MantineSpacing } from '@mantine/core';

interface OTCardProps extends PaperProps {
  children: React.ReactNode;
  hoverable?: boolean;
  header?: React.ReactNode;
  accent?: boolean;
  featured?: boolean;
}

function resolvePaddingVar(p: MantineSpacing | undefined): string {
  if (typeof p === 'string') return `var(--mantine-spacing-${p})`;
  if (typeof p === 'number') return `${p}px`;
  return 'var(--mantine-spacing-lg)';
}

export function OTCard({
  children,
  hoverable = false,
  header,
  accent = false,
  featured = false,
  className,
  p,
  style,
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
      p={p ?? 'lg'}
      withBorder
      className={classes}
      style={{
        '--ot-card-p': resolvePaddingVar(p),
        ...(hoverable
          ? {
              cursor: 'pointer',
              transition: 'border-color 180ms ease, box-shadow 180ms ease',
            }
          : {}),
        ...((style as Record<string, unknown>) ?? {}),
      }}
      {...props}
    >
      {header && <div className="ot-card-header">{header}</div>}
      {children}
    </Paper>
  );
}
