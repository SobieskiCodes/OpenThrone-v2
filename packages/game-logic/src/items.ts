import type { ItemDefinition } from '@openthrone/shared';
import { ItemType, ItemUsage } from '@openthrone/shared';

export const ItemTypes: ItemDefinition[] = [
  // ─── OFFENSE WEAPONS (10 tiers, gated by Armory building) ─────────
  { id: 'OFF-WPN-1', name: 'Dagger', usage: ItemUsage.OFFENSE, level: 1, bonus: 25, cost: 12500, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-WPN-2', name: 'Hatchet', usage: ItemUsage.OFFENSE, level: 2, bonus: 50, cost: 25000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-WPN-3', name: 'Quarterstaff', usage: ItemUsage.OFFENSE, level: 3, bonus: 100, cost: 50000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-WPN-4', name: 'Mace', usage: ItemUsage.OFFENSE, level: 4, bonus: 150, cost: 75000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-WPN-5', name: 'Short Sword', usage: ItemUsage.OFFENSE, level: 5, bonus: 200, cost: 100000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-WPN-6', name: 'Long Sword', usage: ItemUsage.OFFENSE, level: 6, bonus: 275, cost: 137500, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-WPN-7', name: 'Broad Sword', usage: ItemUsage.OFFENSE, level: 7, bonus: 350, cost: 175000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-WPN-8', name: 'Battle Axe', usage: ItemUsage.OFFENSE, level: 8, bonus: 450, cost: 225000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 3, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-WPN-9', name: 'Great Sword', usage: ItemUsage.OFFENSE, level: 9, bonus: 550, cost: 275000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 4, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-WPN-10', name: 'War Hammer', usage: ItemUsage.OFFENSE, level: 10, bonus: 700, cost: 350000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 5, killingStrength: 0, defenseStrength: 0 },

  // ─── OFFENSE ARMOR (10 tiers, gated by Armory building) ───────────
  { id: 'OFF-ARM-1', name: 'Padded Armor', usage: ItemUsage.OFFENSE, level: 1, bonus: 19, cost: 9500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-ARM-2', name: 'Leather Armor', usage: ItemUsage.OFFENSE, level: 2, bonus: 38, cost: 19000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-ARM-3', name: 'Studded Leather Armor', usage: ItemUsage.OFFENSE, level: 3, bonus: 75, cost: 37500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-ARM-4', name: 'Bronze Chainmail', usage: ItemUsage.OFFENSE, level: 4, bonus: 120, cost: 60000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-ARM-5', name: 'Iron Chainmail', usage: ItemUsage.OFFENSE, level: 5, bonus: 180, cost: 90000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-ARM-6', name: 'Steel Chainmail', usage: ItemUsage.OFFENSE, level: 6, bonus: 250, cost: 125000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-ARM-7', name: 'Bronze Plate', usage: ItemUsage.OFFENSE, level: 7, bonus: 350, cost: 175000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-ARM-8', name: 'Iron Plate', usage: ItemUsage.OFFENSE, level: 8, bonus: 450, cost: 225000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 3, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-ARM-9', name: 'Steel Plate', usage: ItemUsage.OFFENSE, level: 9, bonus: 575, cost: 287500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 4, killingStrength: 0, defenseStrength: 0 },
  { id: 'OFF-ARM-10', name: 'Mithril Plate', usage: ItemUsage.OFFENSE, level: 10, bonus: 750, cost: 375000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 5, killingStrength: 0, defenseStrength: 0 },

  // ─── DEFENSE WEAPONS (10 tiers, gated by Armory building) ─────────
  { id: 'DEF-WPN-1', name: 'Sling', usage: ItemUsage.DEFENSE, level: 1, bonus: 25, cost: 12500, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-WPN-2', name: 'Hatchet', usage: ItemUsage.DEFENSE, level: 2, bonus: 50, cost: 25000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-WPN-3', name: 'Spear', usage: ItemUsage.DEFENSE, level: 3, bonus: 100, cost: 50000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-WPN-4', name: 'Javelin', usage: ItemUsage.DEFENSE, level: 4, bonus: 150, cost: 75000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-WPN-5', name: 'Crossbow', usage: ItemUsage.DEFENSE, level: 5, bonus: 200, cost: 100000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-WPN-6', name: 'Heavy Crossbow', usage: ItemUsage.DEFENSE, level: 6, bonus: 275, cost: 137500, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-WPN-7', name: 'Ballista Bolt', usage: ItemUsage.DEFENSE, level: 7, bonus: 350, cost: 175000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-WPN-8', name: 'Greek Fire', usage: ItemUsage.DEFENSE, level: 8, bonus: 450, cost: 225000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 3, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-WPN-9', name: 'Scorpion', usage: ItemUsage.DEFENSE, level: 9, bonus: 550, cost: 275000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 4, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-WPN-10', name: 'Ballista', usage: ItemUsage.DEFENSE, level: 10, bonus: 700, cost: 350000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 5, killingStrength: 0, defenseStrength: 0 },

  // ─── DEFENSE ARMOR (10 tiers, gated by Armory building) ───────────
  { id: 'DEF-ARM-1', name: 'Padded Armor', usage: ItemUsage.DEFENSE, level: 1, bonus: 19, cost: 9500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-ARM-2', name: 'Leather Armor', usage: ItemUsage.DEFENSE, level: 2, bonus: 38, cost: 19000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-ARM-3', name: 'Studded Leather Armor', usage: ItemUsage.DEFENSE, level: 3, bonus: 75, cost: 37500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-ARM-4', name: 'Bronze Chainmail', usage: ItemUsage.DEFENSE, level: 4, bonus: 120, cost: 60000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-ARM-5', name: 'Iron Chainmail', usage: ItemUsage.DEFENSE, level: 5, bonus: 180, cost: 90000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-ARM-6', name: 'Steel Chainmail', usage: ItemUsage.DEFENSE, level: 6, bonus: 250, cost: 125000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-ARM-7', name: 'Bronze Plate', usage: ItemUsage.DEFENSE, level: 7, bonus: 350, cost: 175000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-ARM-8', name: 'Iron Plate', usage: ItemUsage.DEFENSE, level: 8, bonus: 450, cost: 225000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 3, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-ARM-9', name: 'Steel Plate', usage: ItemUsage.DEFENSE, level: 9, bonus: 575, cost: 287500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 4, killingStrength: 0, defenseStrength: 0 },
  { id: 'DEF-ARM-10', name: 'Mithril Plate', usage: ItemUsage.DEFENSE, level: 10, bonus: 750, cost: 375000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 5, killingStrength: 0, defenseStrength: 0 },

  // ─── SPY WEAPONS (10 tiers, gated by Spy Academy building) ────────
  { id: 'SPY-WPN-1', name: 'Throwing Knife', usage: ItemUsage.SPY, level: 1, bonus: 12, cost: 6000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-WPN-2', name: 'Garrote Wire', usage: ItemUsage.SPY, level: 2, bonus: 25, cost: 12500, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-WPN-3', name: 'Blowgun', usage: ItemUsage.SPY, level: 3, bonus: 50, cost: 25000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-WPN-4', name: 'Poison Dagger', usage: ItemUsage.SPY, level: 4, bonus: 80, cost: 40000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-WPN-5', name: 'Stiletto', usage: ItemUsage.SPY, level: 5, bonus: 120, cost: 60000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-WPN-6', name: 'Shadow Blade', usage: ItemUsage.SPY, level: 6, bonus: 170, cost: 85000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-WPN-7', name: 'Assassin Crossbow', usage: ItemUsage.SPY, level: 7, bonus: 230, cost: 115000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-WPN-8', name: 'Nightblade', usage: ItemUsage.SPY, level: 8, bonus: 300, cost: 150000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 3, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-WPN-9', name: 'Wrist Blade', usage: ItemUsage.SPY, level: 9, bonus: 380, cost: 190000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 4, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-WPN-10', name: 'Void Dagger', usage: ItemUsage.SPY, level: 10, bonus: 480, cost: 240000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 5, killingStrength: 0, defenseStrength: 0 },

  // ─── SPY ARMOR (10 tiers, gated by Spy Academy building) ──────────
  { id: 'SPY-ARM-1', name: 'Dark Cloak', usage: ItemUsage.SPY, level: 1, bonus: 12, cost: 6000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-ARM-2', name: 'Shadow Vest', usage: ItemUsage.SPY, level: 2, bonus: 25, cost: 12500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-ARM-3', name: 'Infiltrator Garb', usage: ItemUsage.SPY, level: 3, bonus: 50, cost: 25000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-ARM-4', name: 'Nightstalker Suit', usage: ItemUsage.SPY, level: 4, bonus: 80, cost: 40000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-ARM-5', name: 'Phantom Cloak', usage: ItemUsage.SPY, level: 5, bonus: 120, cost: 60000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-ARM-6', name: 'Assassin Leathers', usage: ItemUsage.SPY, level: 6, bonus: 170, cost: 85000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-ARM-7', name: 'Shadow Weave', usage: ItemUsage.SPY, level: 7, bonus: 230, cost: 115000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-ARM-8', name: 'Void Shroud', usage: ItemUsage.SPY, level: 8, bonus: 300, cost: 150000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 3, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-ARM-9', name: 'Wraithcloak', usage: ItemUsage.SPY, level: 9, bonus: 380, cost: 190000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 4, killingStrength: 0, defenseStrength: 0 },
  { id: 'SPY-ARM-10', name: 'Shadowmeld Armor', usage: ItemUsage.SPY, level: 10, bonus: 480, cost: 240000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 5, killingStrength: 0, defenseStrength: 0 },

  // ─── SENTRY WEAPONS (10 tiers, gated by Spy Academy building) ─────
  { id: 'SEN-WPN-1', name: 'Club', usage: ItemUsage.SENTRY, level: 1, bonus: 12, cost: 6000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-WPN-2', name: 'Hatchet', usage: ItemUsage.SENTRY, level: 2, bonus: 25, cost: 12500, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-WPN-3', name: 'Mace', usage: ItemUsage.SENTRY, level: 3, bonus: 50, cost: 25000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-WPN-4', name: 'Morning Star', usage: ItemUsage.SENTRY, level: 4, bonus: 80, cost: 40000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-WPN-5', name: 'Flail', usage: ItemUsage.SENTRY, level: 5, bonus: 120, cost: 60000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-WPN-6', name: 'War Pick', usage: ItemUsage.SENTRY, level: 6, bonus: 170, cost: 85000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-WPN-7', name: 'Guard Pike', usage: ItemUsage.SENTRY, level: 7, bonus: 230, cost: 115000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-WPN-8', name: 'Sentinel Hammer', usage: ItemUsage.SENTRY, level: 8, bonus: 300, cost: 150000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 3, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-WPN-9', name: 'Inquisitor Blade', usage: ItemUsage.SENTRY, level: 9, bonus: 380, cost: 190000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 4, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-WPN-10', name: 'Nullifier', usage: ItemUsage.SENTRY, level: 10, bonus: 480, cost: 240000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 5, killingStrength: 0, defenseStrength: 0 },

  // ─── SENTRY ARMOR (10 tiers, gated by Spy Academy building) ───────
  { id: 'SEN-ARM-1', name: 'Padded Guard Vest', usage: ItemUsage.SENTRY, level: 1, bonus: 12, cost: 6000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-ARM-2', name: 'Leather Guard Armor', usage: ItemUsage.SENTRY, level: 2, bonus: 25, cost: 12500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-ARM-3', name: 'Studded Guard Armor', usage: ItemUsage.SENTRY, level: 3, bonus: 50, cost: 25000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 0, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-ARM-4', name: 'Bronze Guard Plate', usage: ItemUsage.SENTRY, level: 4, bonus: 80, cost: 40000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-ARM-5', name: 'Iron Guard Plate', usage: ItemUsage.SENTRY, level: 5, bonus: 120, cost: 60000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 1, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-ARM-6', name: 'Steel Guard Plate', usage: ItemUsage.SENTRY, level: 6, bonus: 170, cost: 85000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-ARM-7', name: 'Warden Plate', usage: ItemUsage.SENTRY, level: 7, bonus: 230, cost: 115000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 2, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-ARM-8', name: 'Sentinel Bulwark', usage: ItemUsage.SENTRY, level: 8, bonus: 300, cost: 150000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 3, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-ARM-9', name: 'Inquisitor Shield', usage: ItemUsage.SENTRY, level: 9, bonus: 380, cost: 190000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 4, killingStrength: 0, defenseStrength: 0 },
  { id: 'SEN-ARM-10', name: 'Aegis of Vigilance', usage: ItemUsage.SENTRY, level: 10, bonus: 480, cost: 240000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 5, killingStrength: 0, defenseStrength: 0 },
];

/**
 * Returns an item definition matching the given type, usage, and level.
 */
export function getItemDefinition(
  type: ItemType,
  usage: ItemUsage,
  level: number,
): ItemDefinition | undefined {
  return ItemTypes.find(
    (i) => i.type === type && i.usage === usage && i.level === level,
  );
}

/**
 * Returns all item definitions for the given usage category.
 */
export function getItemsByUsage(usage: ItemUsage): ItemDefinition[] {
  return ItemTypes.filter((i) => i.usage === usage);
}

/**
 * Returns all item definitions for the given usage and item type.
 */
export function getItemsByUsageAndType(
  usage: ItemUsage,
  type: ItemType,
): ItemDefinition[] {
  return ItemTypes.filter((i) => i.usage === usage && i.type === type);
}

/**
 * Computes total armory value from a list of player items.
 * Reusable on both frontend and backend.
 */
export function computeArmoryValue(
  items: Array<{ itemType: string; usage: string; level: number; quantity: number }>,
): number {
  return items.reduce((sum, item) => {
    const def = getItemDefinition(
      item.itemType as ItemType,
      item.usage as ItemUsage,
      item.level,
    );
    return sum + (def?.cost ?? 0) * item.quantity;
  }, 0);
}
