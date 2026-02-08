'use client';

import { Button, type ButtonProps } from '@mantine/core';
import type { MouseEventHandler } from 'react';

type OTVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface OTButtonProps extends Omit<ButtonProps, 'variant' | 'color'> {
  otVariant?: OTVariant;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
}

const variantMap: Record<OTVariant, { variant: ButtonProps['variant']; color?: string }> = {
  primary: { variant: 'filled', color: 'ot' },
  secondary: { variant: 'light', color: 'gray' },
  ghost: { variant: 'subtle', color: 'gray' },
  danger: { variant: 'filled', color: 'red' },
};

export function OTButton({
  otVariant = 'primary',
  children,
  ...props
}: OTButtonProps) {
  const { variant, color } = variantMap[otVariant];
  return (
    <Button variant={variant} color={color} {...props}>
      {children}
    </Button>
  );
}
