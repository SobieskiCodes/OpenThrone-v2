import type { ItemDefinition } from '@openthrone/shared';
import { ItemType, ItemUsage, PlayerRace } from '@openthrone/shared';

export const ItemTypes: ItemDefinition[] = [
  // ─── OFFENSE WEAPONS ────────────────────────────────────────────────
  { id: 'DAGGER', name: 'Dagger', usage: ItemUsage.OFFENSE, level: 1, bonus: 25, cost: 12500, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 1, killingStrength: 20, defenseStrength: 5 },
  { id: 'HATCHET', name: 'Hatchet', usage: ItemUsage.OFFENSE, level: 2, bonus: 50, cost: 25000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 2, killingStrength: 40, defenseStrength: 10 },
  { id: 'QUARTERSTAFF', name: 'Quarterstaff', usage: ItemUsage.OFFENSE, level: 3, bonus: 100, cost: 50000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 3, killingStrength: 80, defenseStrength: 20 },
  { id: 'MACE', name: 'Mace', usage: ItemUsage.OFFENSE, level: 4, bonus: 225, cost: 100000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 4, killingStrength: 180, defenseStrength: 45 },
  { id: 'BATTLE-AXE', name: 'Battle Axe', usage: ItemUsage.OFFENSE, level: 5, bonus: 700, cost: 200000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 5, killingStrength: 560, defenseStrength: 140 },
  { id: 'SHORT-SWORD', name: 'Short Sword', usage: ItemUsage.OFFENSE, level: 6, bonus: 1000, cost: 500000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 6, killingStrength: 800, defenseStrength: 200 },
  { id: 'LONG-SWORD', name: 'Long Sword', usage: ItemUsage.OFFENSE, level: 7, bonus: 1500, cost: 750000, type: ItemType.WEAPON, race: PlayerRace.HUMAN, armoryLevel: 7, killingStrength: 1200, defenseStrength: 300 },
  { id: 'GREAT-SWORD', name: 'Great Sword', usage: ItemUsage.OFFENSE, level: 6, bonus: 1200, cost: 600000, type: ItemType.WEAPON, race: PlayerRace.HUMAN, armoryLevel: 5, killingStrength: 960, defenseStrength: 240 },
  { id: 'ELVEN-LONGBOW', name: 'Elven Longbow', usage: ItemUsage.OFFENSE, level: 6, bonus: 1200, cost: 600000, type: ItemType.WEAPON, race: PlayerRace.ELF, armoryLevel: 5, killingStrength: 960, defenseStrength: 240 },

  // ─── OFFENSE HELMS ──────────────────────────────────────────────────
  { id: 'OFF-PADDED-HOOD', name: 'Padded Hood', usage: ItemUsage.OFFENSE, level: 1, bonus: 6, cost: 3000, type: ItemType.HELM, race: 'ALL', armoryLevel: 1, killingStrength: 1, defenseStrength: 5 },
  { id: 'OFF-LEATHER-HOOD', name: 'Leather Hood', usage: ItemUsage.OFFENSE, level: 2, bonus: 12, cost: 6000, type: ItemType.HELM, race: 'ALL', armoryLevel: 2, killingStrength: 2, defenseStrength: 10 },
  { id: 'OFF-STUDDED-LEATHER-HOOD', name: 'Studded Leather Hood', usage: ItemUsage.OFFENSE, level: 3, bonus: 25, cost: 12500, type: ItemType.HELM, race: 'ALL', armoryLevel: 3, killingStrength: 5, defenseStrength: 20 },

  // ─── OFFENSE ARMOR ──────────────────────────────────────────────────
  { id: 'OFF-PADDED-ARMOR', name: 'Padded Armor', usage: ItemUsage.OFFENSE, level: 1, bonus: 19, cost: 9500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 1, killingStrength: 4, defenseStrength: 15 },
  { id: 'OFF-LEATHER-ARMOR', name: 'Leather Armor', usage: ItemUsage.OFFENSE, level: 2, bonus: 38, cost: 19000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 2, killingStrength: 8, defenseStrength: 30 },
  { id: 'OFF-STUDDED-LEATHER-ARMOR', name: 'Studded Leather Armor', usage: ItemUsage.OFFENSE, level: 3, bonus: 75, cost: 37500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 3, killingStrength: 15, defenseStrength: 60 },

  // ─── OFFENSE BOOTS ──────────────────────────────────────────────────
  { id: 'OFF-PADDED-BOOTS', name: 'Padded Boots', usage: ItemUsage.OFFENSE, level: 1, bonus: 6, cost: 3000, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 1, killingStrength: 1, defenseStrength: 5 },
  { id: 'OFF-LEATHER-BOOTS', name: 'Leather Boots', usage: ItemUsage.OFFENSE, level: 2, bonus: 12, cost: 6000, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 2, killingStrength: 2, defenseStrength: 10 },
  { id: 'OFF-STUDDED-LEATHER-BOOTS', name: 'Studded Leather Boots', usage: ItemUsage.OFFENSE, level: 3, bonus: 25, cost: 12500, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 3, killingStrength: 5, defenseStrength: 20 },

  // ─── OFFENSE BRACERS ────────────────────────────────────────────────
  { id: 'OFF-PADDED-BRACERS', name: 'Padded Bracers', usage: ItemUsage.OFFENSE, level: 1, bonus: 3, cost: 1500, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 1, killingStrength: 1, defenseStrength: 2 },
  { id: 'OFF-LEATHER-BRACERS', name: 'Leather Bracers', usage: ItemUsage.OFFENSE, level: 2, bonus: 5, cost: 2500, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 2, killingStrength: 2, defenseStrength: 3 },
  { id: 'OFF-STUDDED-LEATHER-BRACERS', name: 'Studded Leather Bracers', usage: ItemUsage.OFFENSE, level: 3, bonus: 10, cost: 5000, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 3, killingStrength: 5, defenseStrength: 5 },

  // ─── OFFENSE SHIELDS ────────────────────────────────────────────────
  { id: 'OFF-SMALL-WOODEN-SHIELD', name: 'Small Wooden Shield', usage: ItemUsage.OFFENSE, level: 1, bonus: 12, cost: 6000, type: ItemType.SHIELD, race: 'ALL', armoryLevel: 1, killingStrength: 2, defenseStrength: 10 },
  { id: 'OFF-MEDIUM-WOODEN-SHIELD', name: 'Medium Wooden Shield', usage: ItemUsage.OFFENSE, level: 2, bonus: 25, cost: 12500, type: ItemType.SHIELD, race: 'ALL', armoryLevel: 2, killingStrength: 5, defenseStrength: 20 },
  { id: 'OFF-LARGE-WOODEN-SHIELD', name: 'Large Wooden Shield', usage: ItemUsage.OFFENSE, level: 3, bonus: 50, cost: 25000, type: ItemType.SHIELD, race: 'ALL', armoryLevel: 3, killingStrength: 10, defenseStrength: 40 },

  // ─── DEFENSE WEAPONS ────────────────────────────────────────────────
  { id: 'DEF-SLING', name: 'Sling', usage: ItemUsage.DEFENSE, level: 1, bonus: 25, cost: 12500, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 1, killingStrength: 20, defenseStrength: 5 },
  { id: 'DEF-HATCHET', name: 'Hatchet', usage: ItemUsage.DEFENSE, level: 2, bonus: 50, cost: 25000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 2, killingStrength: 40, defenseStrength: 10 },
  { id: 'DEF-SPEAR', name: 'Spear', usage: ItemUsage.DEFENSE, level: 3, bonus: 100, cost: 50000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 3, killingStrength: 80, defenseStrength: 20 },

  // ─── DEFENSE HELMS ──────────────────────────────────────────────────
  { id: 'DEF-PADDED-HOOD', name: 'Padded Hood', usage: ItemUsage.DEFENSE, level: 1, bonus: 6, cost: 3000, type: ItemType.HELM, race: 'ALL', armoryLevel: 1, killingStrength: 1, defenseStrength: 5 },
  { id: 'DEF-LEATHER-HOOD', name: 'Leather Hood', usage: ItemUsage.DEFENSE, level: 2, bonus: 12, cost: 6000, type: ItemType.HELM, race: 'ALL', armoryLevel: 2, killingStrength: 2, defenseStrength: 10 },
  { id: 'DEF-STUDDED-LEATHER-HOOD', name: 'Studded Leather Hood', usage: ItemUsage.DEFENSE, level: 3, bonus: 25, cost: 12500, type: ItemType.HELM, race: 'ALL', armoryLevel: 3, killingStrength: 5, defenseStrength: 20 },

  // ─── DEFENSE ARMOR ──────────────────────────────────────────────────
  { id: 'DEF-PADDED-ARMOR', name: 'Padded Armor', usage: ItemUsage.DEFENSE, level: 1, bonus: 19, cost: 9500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 1, killingStrength: 4, defenseStrength: 15 },
  { id: 'DEF-LEATHER-ARMOR', name: 'Leather Armor', usage: ItemUsage.DEFENSE, level: 2, bonus: 38, cost: 19000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 2, killingStrength: 8, defenseStrength: 30 },
  { id: 'DEF-STUDDED-LEATHER-ARMOR', name: 'Studded Leather Armor', usage: ItemUsage.DEFENSE, level: 3, bonus: 75, cost: 37500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 3, killingStrength: 15, defenseStrength: 60 },

  // ─── DEFENSE BOOTS ──────────────────────────────────────────────────
  { id: 'DEF-PADDED-BOOTS', name: 'Padded Boots', usage: ItemUsage.DEFENSE, level: 1, bonus: 6, cost: 3000, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 1, killingStrength: 1, defenseStrength: 5 },
  { id: 'DEF-LEATHER-BOOTS', name: 'Leather Boots', usage: ItemUsage.DEFENSE, level: 2, bonus: 12, cost: 6000, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 2, killingStrength: 2, defenseStrength: 10 },
  { id: 'DEF-STUDDED-LEATHER-BOOTS', name: 'Studded Leather Boots', usage: ItemUsage.DEFENSE, level: 3, bonus: 25, cost: 12500, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 3, killingStrength: 5, defenseStrength: 20 },

  // ─── DEFENSE BRACERS ────────────────────────────────────────────────
  { id: 'DEF-PADDED-BRACERS', name: 'Padded Bracers', usage: ItemUsage.DEFENSE, level: 1, bonus: 3, cost: 1500, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 1, killingStrength: 1, defenseStrength: 2 },
  { id: 'DEF-LEATHER-BRACERS', name: 'Leather Bracers', usage: ItemUsage.DEFENSE, level: 2, bonus: 5, cost: 2500, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 2, killingStrength: 2, defenseStrength: 3 },
  { id: 'DEF-STUDDED-LEATHER-BRACERS', name: 'Studded Leather Bracers', usage: ItemUsage.DEFENSE, level: 3, bonus: 10, cost: 5000, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 3, killingStrength: 5, defenseStrength: 5 },

  // ─── DEFENSE SHIELDS ────────────────────────────────────────────────
  { id: 'DEF-SMALL-WOODEN-SHIELD', name: 'Small Wooden Shield', usage: ItemUsage.DEFENSE, level: 1, bonus: 12, cost: 6000, type: ItemType.SHIELD, race: 'ALL', armoryLevel: 1, killingStrength: 2, defenseStrength: 10 },
  { id: 'DEF-MEDIUM-WOODEN-SHIELD', name: 'Medium Wooden Shield', usage: ItemUsage.DEFENSE, level: 2, bonus: 25, cost: 12500, type: ItemType.SHIELD, race: 'ALL', armoryLevel: 2, killingStrength: 5, defenseStrength: 20 },
  { id: 'DEF-LARGE-WOODEN-SHIELD', name: 'Large Wooden Shield', usage: ItemUsage.DEFENSE, level: 3, bonus: 50, cost: 25000, type: ItemType.SHIELD, race: 'ALL', armoryLevel: 3, killingStrength: 10, defenseStrength: 40 },

  // ─── SPY WEAPONS ────────────────────────────────────────────────────
  { id: 'SPY-SLING', name: 'Sling', usage: ItemUsage.SPY, level: 1, bonus: 25, cost: 12500, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 1, killingStrength: 20, defenseStrength: 5 },
  { id: 'SPY-BRASS-KNUCKLES', name: 'Brass Knuckles', usage: ItemUsage.SPY, level: 2, bonus: 50, cost: 25000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 2, killingStrength: 40, defenseStrength: 10 },
  { id: 'SPY-CUDGEL', name: 'Cudgel', usage: ItemUsage.SPY, level: 3, bonus: 100, cost: 50000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 3, killingStrength: 80, defenseStrength: 20 },
  { id: 'SPY-KNIFE', name: 'Knife', usage: ItemUsage.SPY, level: 4, bonus: 225, cost: 100000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 4, killingStrength: 180, defenseStrength: 45 },

  // ─── SPY HELMS ──────────────────────────────────────────────────────
  { id: 'SPY-CLOTH-CAP', name: 'Cloth Cap', usage: ItemUsage.SPY, level: 1, bonus: 6, cost: 3000, type: ItemType.HELM, race: 'ALL', armoryLevel: 1, killingStrength: 1, defenseStrength: 5 },
  { id: 'SPY-PADDED-CAP', name: 'Padded Cap', usage: ItemUsage.SPY, level: 2, bonus: 12, cost: 6000, type: ItemType.HELM, race: 'ALL', armoryLevel: 2, killingStrength: 2, defenseStrength: 10 },
  { id: 'SPY-LEATHER-CAP', name: 'Leather Cap', usage: ItemUsage.SPY, level: 3, bonus: 25, cost: 12500, type: ItemType.HELM, race: 'ALL', armoryLevel: 3, killingStrength: 5, defenseStrength: 20 },
  { id: 'SPY-CLOTH-HOOD', name: 'Cloth Hood', usage: ItemUsage.SPY, level: 4, bonus: 50, cost: 25000, type: ItemType.HELM, race: 'ALL', armoryLevel: 4, killingStrength: 10, defenseStrength: 40 },

  // ─── SPY ARMOR ──────────────────────────────────────────────────────
  { id: 'SPY-DARK-CLOTH-ARMOR', name: 'Dark Cloth Armor', usage: ItemUsage.SPY, level: 1, bonus: 19, cost: 9500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 1, killingStrength: 4, defenseStrength: 15 },
  { id: 'SPY-PADDED-CLOTH-ARMOR', name: 'Padded Cloth Armor', usage: ItemUsage.SPY, level: 2, bonus: 38, cost: 19000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 2, killingStrength: 8, defenseStrength: 30 },
  { id: 'SPY-LEATHER-ARMOR', name: 'Leather Armor', usage: ItemUsage.SPY, level: 3, bonus: 75, cost: 37500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 3, killingStrength: 15, defenseStrength: 60 },
  { id: 'SPY-PADDED-LEATHER-ARMOR', name: 'Padded Leather Armor', usage: ItemUsage.SPY, level: 4, bonus: 150, cost: 75000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 4, killingStrength: 60, defenseStrength: 90 },

  // ─── SPY BOOTS ──────────────────────────────────────────────────────
  { id: 'SPY-CLOTH-BOOTS', name: 'Cloth Boots', usage: ItemUsage.SPY, level: 1, bonus: 6, cost: 3000, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 1, killingStrength: 1, defenseStrength: 5 },
  { id: 'SPY-PADDED-BOOTS', name: 'Padded Boots', usage: ItemUsage.SPY, level: 2, bonus: 12, cost: 6000, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 2, killingStrength: 2, defenseStrength: 10 },
  { id: 'SPY-LEATHER-BOOTS', name: 'Leather Boots', usage: ItemUsage.SPY, level: 3, bonus: 25, cost: 12500, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 3, killingStrength: 5, defenseStrength: 20 },
  { id: 'SPY-PADDED-LEATHER-BOOTS', name: 'Padded Leather Boots', usage: ItemUsage.SPY, level: 4, bonus: 50, cost: 25000, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 4, killingStrength: 20, defenseStrength: 30 },

  // ─── SPY BRACERS ────────────────────────────────────────────────────
  { id: 'SPY-CLOTH-BRACERS', name: 'Cloth Bracers', usage: ItemUsage.SPY, level: 1, bonus: 3, cost: 1500, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 1, killingStrength: 1, defenseStrength: 2 },
  { id: 'SPY-PADDED-BRACERS', name: 'Padded Bracers', usage: ItemUsage.SPY, level: 2, bonus: 5, cost: 2500, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 2, killingStrength: 2, defenseStrength: 3 },
  { id: 'SPY-LEATHER-BRACERS', name: 'Leather Bracers', usage: ItemUsage.SPY, level: 3, bonus: 10, cost: 5000, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 3, killingStrength: 5, defenseStrength: 5 },
  { id: 'SPY-PADDED-LEATHER-BRACERS', name: 'Padded Leather Bracers', usage: ItemUsage.SPY, level: 4, bonus: 20, cost: 10000, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 4, killingStrength: 8, defenseStrength: 12 },

  // ─── SENTRY WEAPONS ─────────────────────────────────────────────────
  { id: 'SEN-SLING', name: 'Sling', usage: ItemUsage.SENTRY, level: 1, bonus: 25, cost: 12500, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 1, killingStrength: 20, defenseStrength: 5 },
  { id: 'SEN-DAGGER', name: 'Dagger', usage: ItemUsage.SENTRY, level: 2, bonus: 50, cost: 25000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 2, killingStrength: 40, defenseStrength: 10 },
  { id: 'SEN-HATCHET', name: 'Hatchet', usage: ItemUsage.SENTRY, level: 3, bonus: 100, cost: 50000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 3, killingStrength: 80, defenseStrength: 20 },
  { id: 'SEN-QUARTERSTAFF', name: 'Quarterstaff', usage: ItemUsage.SENTRY, level: 4, bonus: 225, cost: 100000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 4, killingStrength: 180, defenseStrength: 45 },
  { id: 'SEN-MACE', name: 'Mace', usage: ItemUsage.SENTRY, level: 5, bonus: 700, cost: 200000, type: ItemType.WEAPON, race: 'ALL', armoryLevel: 5, killingStrength: 560, defenseStrength: 140 },

  // ─── SENTRY HELMS ──────────────────────────────────────────────────
  { id: 'SEN-PADDED-HOOD', name: 'Padded Hood', usage: ItemUsage.SENTRY, level: 1, bonus: 6, cost: 3000, type: ItemType.HELM, race: 'ALL', armoryLevel: 1, killingStrength: 1, defenseStrength: 5 },
  { id: 'SEN-LEATHER-HOOD', name: 'Leather Hood', usage: ItemUsage.SENTRY, level: 2, bonus: 12, cost: 6000, type: ItemType.HELM, race: 'ALL', armoryLevel: 2, killingStrength: 2, defenseStrength: 10 },
  { id: 'SEN-STUDDED-LEATHER-HOOD', name: 'Studded Leather Hood', usage: ItemUsage.SENTRY, level: 3, bonus: 25, cost: 12500, type: ItemType.HELM, race: 'ALL', armoryLevel: 3, killingStrength: 5, defenseStrength: 20 },
  { id: 'SEN-BRONZE-CAP', name: 'Bronze Cap', usage: ItemUsage.SENTRY, level: 4, bonus: 50, cost: 25000, type: ItemType.HELM, race: 'ALL', armoryLevel: 4, killingStrength: 10, defenseStrength: 40 },

  // ─── SENTRY ARMOR ──────────────────────────────────────────────────
  { id: 'SEN-PADDED-ARMOR', name: 'Padded Armor', usage: ItemUsage.SENTRY, level: 1, bonus: 19, cost: 9500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 1, killingStrength: 4, defenseStrength: 15 },
  { id: 'SEN-LEATHER-ARMOR', name: 'Leather Armor', usage: ItemUsage.SENTRY, level: 2, bonus: 38, cost: 19000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 2, killingStrength: 8, defenseStrength: 30 },
  { id: 'SEN-STUDDED-LEATHER-ARMOR', name: 'Studded Leather Armor', usage: ItemUsage.SENTRY, level: 3, bonus: 75, cost: 37500, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 3, killingStrength: 15, defenseStrength: 60 },
  { id: 'SEN-BRONZE-CHAINMAIL', name: 'Bronze Chainmail', usage: ItemUsage.SENTRY, level: 4, bonus: 150, cost: 75000, type: ItemType.ARMOR, race: 'ALL', armoryLevel: 4, killingStrength: 60, defenseStrength: 90 },

  // ─── SENTRY BOOTS ──────────────────────────────────────────────────
  { id: 'SEN-PADDED-BOOTS', name: 'Padded Boots', usage: ItemUsage.SENTRY, level: 1, bonus: 6, cost: 3000, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 1, killingStrength: 1, defenseStrength: 5 },
  { id: 'SEN-LEATHER-BOOTS', name: 'Leather Boots', usage: ItemUsage.SENTRY, level: 2, bonus: 12, cost: 6000, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 2, killingStrength: 2, defenseStrength: 10 },
  { id: 'SEN-STUDDED-LEATHER-GREAVES', name: 'Studded Leather Greaves', usage: ItemUsage.SENTRY, level: 3, bonus: 25, cost: 12500, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 3, killingStrength: 5, defenseStrength: 20 },
  { id: 'SEN-BRONZE-CHAIN-GREAVES', name: 'Bronze Chain Greaves', usage: ItemUsage.SENTRY, level: 4, bonus: 50, cost: 25000, type: ItemType.BOOTS, race: 'ALL', armoryLevel: 4, killingStrength: 20, defenseStrength: 30 },

  // ─── SENTRY BRACERS ────────────────────────────────────────────────
  { id: 'SEN-PADDED-BRACERS', name: 'Padded Bracers', usage: ItemUsage.SENTRY, level: 1, bonus: 3, cost: 1500, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 1, killingStrength: 1, defenseStrength: 2 },
  { id: 'SEN-LEATHER-BRACERS', name: 'Leather Bracers', usage: ItemUsage.SENTRY, level: 2, bonus: 5, cost: 2500, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 2, killingStrength: 2, defenseStrength: 3 },
  { id: 'SEN-STUDDED-LEATHER-BRACERS', name: 'Studded Leather Bracers', usage: ItemUsage.SENTRY, level: 3, bonus: 10, cost: 5000, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 3, killingStrength: 5, defenseStrength: 5 },
  { id: 'SEN-BRONZE-CHAIN-BRACERS', name: 'Bronze Chain Bracers', usage: ItemUsage.SENTRY, level: 4, bonus: 20, cost: 10000, type: ItemType.BRACERS, race: 'ALL', armoryLevel: 4, killingStrength: 8, defenseStrength: 12 },

  // ─── SENTRY SHIELDS ────────────────────────────────────────────────
  { id: 'SEN-SMALL-WOODEN-SHIELD', name: 'Small Wooden Shield', usage: ItemUsage.SENTRY, level: 1, bonus: 12, cost: 6000, type: ItemType.SHIELD, race: 'ALL', armoryLevel: 1, killingStrength: 2, defenseStrength: 10 },
  { id: 'SEN-MEDIUM-WOODEN-SHIELD', name: 'Medium Wooden Shield', usage: ItemUsage.SENTRY, level: 2, bonus: 25, cost: 12500, type: ItemType.SHIELD, race: 'ALL', armoryLevel: 2, killingStrength: 5, defenseStrength: 20 },
  { id: 'SEN-LARGE-WOODEN-SHIELD', name: 'Large Wooden Shield', usage: ItemUsage.SENTRY, level: 3, bonus: 50, cost: 25000, type: ItemType.SHIELD, race: 'ALL', armoryLevel: 3, killingStrength: 10, defenseStrength: 40 },
  { id: 'SEN-BRONZE-STUDDED-SHIELD', name: 'Bronze Studded Shield', usage: ItemUsage.SENTRY, level: 4, bonus: 100, cost: 50000, type: ItemType.SHIELD, race: 'ALL', armoryLevel: 4, killingStrength: 40, defenseStrength: 60 },
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
