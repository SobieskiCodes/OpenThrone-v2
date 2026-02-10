'use client';

import { Group, Text, Tooltip } from '@mantine/core';

interface TooltipStatProps {
  label: string;
  value: React.ReactNode;
  tooltip: React.ReactNode;
  valueColor?: string;
  tooltipWidth?: number;
}

export function TooltipStat({
  label,
  value,
  tooltip,
  valueColor,
  tooltipWidth = 250,
}: TooltipStatProps) {
  return (
    <Tooltip label={tooltip} multiline w={tooltipWidth}>
      <Group justify="space-between" className="ot-tooltip-hint">
        <Text size="sm" className="ot-text-dim ot-tooltip-hint">
          {label}
        </Text>
        <Text
          fw={600}
          className={valueColor ? undefined : 'ot-stat-value'}
          style={valueColor ? { color: valueColor } : undefined}
        >
          {value}
        </Text>
      </Group>
    </Tooltip>
  );
}
