'use client';

import { Group, Text, Tooltip } from '@mantine/core';
import type { TablerIcon } from '@tabler/icons-react';

interface TooltipStatProps {
  label: string;
  value: React.ReactNode;
  tooltip: React.ReactNode;
  valueColor?: string;
  tooltipWidth?: number;
  icon?: TablerIcon;
}

export function TooltipStat({
  label,
  value,
  tooltip,
  valueColor,
  tooltipWidth = 250,
  icon: Icon,
}: TooltipStatProps) {
  return (
    <Tooltip label={tooltip} multiline w={tooltipWidth}>
      <Group justify="space-between" className="ot-tooltip-hint">
        <Group gap={8} wrap="nowrap">
          {Icon && <Icon size={13} className="ot-dashboard-stat-icon" />}
          <Text size="sm" className="ot-text-dim ot-tooltip-hint">
            {label}
          </Text>
        </Group>
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
