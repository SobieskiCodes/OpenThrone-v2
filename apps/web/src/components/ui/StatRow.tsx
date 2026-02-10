'use client';

import { Group, Text } from '@mantine/core';

interface StatRowProps {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatRow({ label, value, valueColor, size = 'md' }: StatRowProps) {
  const labelSize = size === 'lg' ? 'md' : size === 'md' ? 'sm' : 'xs';
  const valueSize = size === 'lg' ? 'lg' : size === 'md' ? 'md' : 'sm';

  return (
    <Group justify="space-between" wrap="nowrap">
      <Text size={labelSize} className="ot-text-dim">
        {label}
      </Text>
      <Text
        size={valueSize}
        fw={600}
        className={valueColor ? undefined : 'ot-stat-value'}
        style={valueColor ? { color: valueColor, fontVariantNumeric: 'tabular-nums' } : undefined}
      >
        {value}
      </Text>
    </Group>
  );
}
