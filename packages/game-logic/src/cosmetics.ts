/**
 * Cosmetics Shop - Name colors, icons, and other customization options
 * Players can purchase these with gold to personalize their appearance in chat
 */

export enum CosmeticType {
  NAME_COLOR = 'NAME_COLOR',
  ICON = 'ICON',
}

export interface CosmeticDefinition {
  id: string;
  type: CosmeticType;
  name: string;
  value: string; // Hex color or emoji
  price: bigint;
  description?: string;
}

// ─── Name Colors ─────────────────────────────────────────────────────────────

export const NAME_COLORS: CosmeticDefinition[] = [
  {
    id: 'color-royal-purple',
    type: CosmeticType.NAME_COLOR,
    name: 'Royal Purple',
    value: '#9333EA',
    price: 50000n,
    description: 'A regal purple fit for nobility',
  },
  {
    id: 'color-blood-red',
    type: CosmeticType.NAME_COLOR,
    name: 'Blood Red',
    value: '#DC2626',
    price: 50000n,
    description: 'Strike fear into your enemies',
  },
  {
    id: 'color-golden',
    type: CosmeticType.NAME_COLOR,
    name: 'Golden',
    value: '#F59E0B',
    price: 75000n,
    description: 'Shine like treasure',
  },
  {
    id: 'color-emerald',
    type: CosmeticType.NAME_COLOR,
    name: 'Emerald',
    value: '#10B981',
    price: 75000n,
    description: 'Vibrant and verdant',
  },
  {
    id: 'color-sapphire',
    type: CosmeticType.NAME_COLOR,
    name: 'Sapphire',
    value: '#3B82F6',
    price: 75000n,
    description: 'Deep as the ocean',
  },
  {
    id: 'color-shadow',
    type: CosmeticType.NAME_COLOR,
    name: 'Shadow',
    value: '#475569',
    price: 100000n,
    description: 'Lurk in darkness',
  },
  {
    id: 'color-flame',
    type: CosmeticType.NAME_COLOR,
    name: 'Flame',
    value: '#F97316',
    price: 100000n,
    description: 'Burn bright',
  },
];

// ─── Icons ───────────────────────────────────────────────────────────────────

export const ICONS: CosmeticDefinition[] = [
  {
    id: 'icon-crown',
    type: CosmeticType.ICON,
    name: 'Crown',
    value: '👑',
    price: 100000n,
    description: 'Show your royal status',
  },
  {
    id: 'icon-sword',
    type: CosmeticType.ICON,
    name: 'Crossed Swords',
    value: '⚔️',
    price: 75000n,
    description: 'A warrior\'s mark',
  },
  {
    id: 'icon-shield',
    type: CosmeticType.ICON,
    name: 'Shield',
    value: '🛡️',
    price: 75000n,
    description: 'Defender of the realm',
  },
  {
    id: 'icon-fire',
    type: CosmeticType.ICON,
    name: 'Fire',
    value: '🔥',
    price: 150000n,
    description: 'Unleash destruction',
  },
  {
    id: 'icon-skull',
    type: CosmeticType.ICON,
    name: 'Skull',
    value: '💀',
    price: 125000n,
    description: 'Death comes for all',
  },
  {
    id: 'icon-star',
    type: CosmeticType.ICON,
    name: 'Star',
    value: '⭐',
    price: 125000n,
    description: 'Shine among legends',
  },
  {
    id: 'icon-dragon',
    type: CosmeticType.ICON,
    name: 'Dragon',
    value: '🐉',
    price: 200000n,
    description: 'Rare and powerful',
  },
];

// ─── All Cosmetics ───────────────────────────────────────────────────────────

export const ALL_COSMETICS: CosmeticDefinition[] = [
  ...NAME_COLORS,
  ...ICONS,
];

// ─── Helper Functions ────────────────────────────────────────────────────────

export function getCosmeticById(id: string): CosmeticDefinition | undefined {
  return ALL_COSMETICS.find((c) => c.id === id);
}

export function getCosmeticsByType(type: CosmeticType): CosmeticDefinition[] {
  return ALL_COSMETICS.filter((c) => c.type === type);
}
