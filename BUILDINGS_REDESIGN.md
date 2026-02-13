# Buildings Redesign — Progression Gate System

> Reference: DarkThrone Game (discord data + in-game screenshots, Feb 2026)
> Goal: Buildings become the single progression backbone. Each building level gates unit tiers, item tiers, and passive bonuses.

## Design Principles

1. **Buildings gate everything** — units, items, and bonuses are locked behind building levels
2. **Level + gold = gate** — you need both the player level AND the gold to upgrade
3. **Power spikes are intentional** — upgrading a building unlocks a whole new tier of power
4. **Hidden until unlocked** — Mercenary Camp gets its own nav page only after Lv1 is purchased
5. **Cross-building requirements** — some top-tier units need multiple buildings at high levels
6. **No barracks** — citizens come from housing + recruiting, not a passive building

---

## Buildings (7 types, adapted from DarkThrone)

### Fortification (Fort HP + Gates Military Tiers)
| Level | Name | Req Lvl | Cost | Effect |
|-------|------|---------|------|--------|
| 1 | Wooden Palisade | 10 | 500K | Fort HP tier 1, unlocks Tier 2 military |
| 2 | Fortified Outpost | 20 | 3M | Fort HP tier 2, unlocks Tier 2 military units |
| 3 | Fortified Stronghold | 40 | 80M | Fort HP tier 3, unlocks Tier 3 military units |
| 4 | Fortified Fortress | 60 | 500M | Fort HP tier 4, unlocks Tier 4 military units |
| 5 | Citadel | 80 | 1B | Fort HP tier 5 |

### Armory (Gates Equipment Tiers)
| Level | Name | Req Lvl | Cost | Effect |
|-------|------|---------|------|--------|
| 1 | Chainmail Armory I | 10 | 750K | Item tiers 1-5 available |
| 2 | Chainmail Armory II | 30 | 7M | Unlocks item tiers 6-7 |
| 3 | Chainmail Armory III | 50 | 35M | Unlocks item tier 8 |
| 4 | Plate Armory I | 70 | 650M | Unlocks item tier 9 |
| 5 | Plate Armory II | 90 | 2B | Unlocks item tier 10 |

### Mine (Gates Worker Tiers + Income)
| Level | Name | Req Lvl | Cost | Effect |
|-------|------|---------|------|--------|
| 1 | Basic Mine | 3 | 150K | +10% income, Tier 1 workers |
| 2 | Improved Mine | 12 | 3.5M | +20% income, Tier 2 workers |
| 3 | Advanced Mine | 24 | 60M | +30% income, Tier 3 workers |
| 4 | Deep Mine | 36 | 800M | +40% income |
| 5 | Mithril Mine | 48 | 2B | +50% income |

### Spy Academy (Gates Spy Tiers)
| Level | Name | Req Lvl | Cost | Effect |
|-------|------|---------|------|--------|
| 1 | Spy School | 5 | 250K | +5 spy offense, Tier 1 spies |
| 2 | Spy Academy | 15 | 4M | +10 spy offense, Tier 2 spies |
| 3 | Intelligence Bureau | 30 | 70M | +15 spy offense, Tier 3 spies (+ Fort Lv3) |
| 4 | Secret Service HQ | 45 | 250M | +20 spy offense |
| 5 | Shadow Council | 60 | 4.5B | +25 spy offense |

### Housing (Citizens/Day)
| Level | Name | Req Lvl | Cost | Effect |
|-------|------|---------|------|--------|
| 1 | Huts | 3 | 100K | +10 citizens/day |
| 2 | Cottages | 13 | 3M | +20 citizens/day |
| 3 | Houses | 33 | 75M | +30 citizens/day |
| 4 | Estates | 63 | 550M | +40 citizens/day |
| 5 | Mansions | 93 | 1.75B | +50 citizens/day |

### Mercenary Camp (Daily Merc Stock — own page once unlocked)
| Level | Name | Req Lvl | Cost | Effect |
|-------|------|---------|------|--------|
| 1 | Mercenary Camp I | 7 | 200K | 20 mercs/day |
| 2 | Mercenary Camp II | 14 | 4.5M | 30 mercs/day |
| 3 | Mercenary Camp III | 21 | 55M | 40 mercs/day |

---

## Unit Tiers (gated by buildings)

### Workers
| Tier | Unit | Income/Turn | Cost | Requires |
|------|------|-------------|------|----------|
| 1 | Worker | +65/turn | 2,000 + 1 citizen | — |
| 2 | Expert Miner | +150/turn | 5,000 + 1 citizen | — |
| 3 | Master Miner | +400/turn | 15,000 + 1 citizen | Mine Lv3 |

### Offensive Military
| Tier | Unit | ATK | Cost | Requires |
|------|------|-----|------|----------|
| 1 | Soldier | 3 | 1,500 + 1 citizen | — |
| 2 | Knight | 20 | 10,000 + 1 citizen | Fortification Lv2 |
| 3 | Berserker | 50 | 25,000 + 1 citizen | Fortification Lv3 |
| 4 | Warrior | 100 | 50,000 + 1 citizen | Fortification Lv4 |

### Defensive Military
| Tier | Unit | DEF | Cost | Requires |
|------|------|-----|------|----------|
| 1 | Guard | 3 | 1,500 + 1 citizen | — |
| 2 | Archer | 20 | 10,000 + 1 citizen | Fortification Lv2 |
| 3 | Royal Guard | 50 | 25,000 + 1 citizen | Fortification Lv3 |
| 4 | Elite Archer | 100 | 50,000 + 1 citizen | Fortification Lv4 |

### Spy Offensive
| Tier | Unit | SPY | Cost | Requires |
|------|------|-----|------|----------|
| 1 | Spy | 5 | 2,500 + 1 citizen | — |
| 2 | Infiltrator | 25 | 15,000 + 1 citizen | Spy Academy Lv2 |
| 3 | Assassin | 60 | 35,000 + 1 citizen | Fortification Lv3 + Spy Academy Lv3 |

### Spy Defensive
| Tier | Unit | SENTRY | Cost | Requires |
|------|------|--------|------|----------|
| 1 | Sentry | 5 | 2,500 + 1 citizen | — |
| 2 | Sentinel | 25 | 15,000 + 1 citizen | Spy Academy Lv2 |
| 3 | Inquisitor | 60 | 35,000 + 1 citizen | Fortification Lv3 + Spy Academy Lv3 |

---

## Item Tiers (gated by Armory building)

### Offense Weapons (10 tiers, gated by Armory)
| Tier | Item | OFF | Cost | Requires |
|------|------|-----|------|----------|
| 1 | Dagger | +25 | 12,500 | — |
| 2 | Hatchet | +50 | 25,000 | — |
| 3 | Quarterstaff | +100 | 50,000 | — |
| 4 | Mace | +150 | 75,000 | — |
| 5 | Short Sword | +200 | 100,000 | — |
| 6 | Long Sword | +275 | 137,500 | Armory Lv2 |
| 7 | Broad Sword | +350 | 175,000 | Armory Lv2 |
| 8 | Battle Axe | +450 | 225,000 | Armory Lv3 |
| 9 | Great Sword | +550 | 275,000 | Armory Lv4 |
| 10 | War Hammer | +700 | 350,000 | Armory Lv5 |

### Offense Armor (10 tiers, gated by Armory)
| Tier | Item | OFF | Cost | Requires |
|------|------|-----|------|----------|
| 1 | Padded Armor | +19 | 9,500 | — |
| 2 | Leather Armor | +38 | 19,000 | — |
| 3 | Studded Leather Armor | +75 | 37,500 | — |
| 4 | Bronze Chainmail | +120 | 60,000 | — |
| 5 | Iron Chainmail | +180 | 90,000 | — |
| 6 | Steel Chainmail | +250 | 125,000 | Armory Lv2 |
| 7 | Bronze Plate | +350 | 175,000 | Armory Lv2 |
| 8 | Iron Plate | +450 | 225,000 | Armory Lv3 |
| 9 | Steel Plate | +575 | 287,500 | Armory Lv4 |
| 10 | Mithril Plate | +750 | 375,000 | Armory Lv5 |

### Defense Weapons (10 tiers, gated by Armory)
| Tier | Item | DEF | Cost | Requires |
|------|------|-----|------|----------|
| 1 | Sling | +25 | 12,500 | — |
| 2 | Hatchet | +50 | 25,000 | — |
| 3 | Spear | +100 | 50,000 | — |
| 4 | Javelin | +150 | 75,000 | — |
| 5 | Crossbow | +200 | 100,000 | — |
| 6 | Heavy Crossbow | +275 | 137,500 | Armory Lv2 |
| 7 | Ballista Bolt | +350 | 175,000 | Armory Lv2 |
| 8 | Greek Fire | +450 | 225,000 | Armory Lv3 |
| 9 | Scorpion | +550 | 275,000 | Armory Lv4 |
| 10 | Ballista | +700 | 350,000 | Armory Lv5 |

### Defense Armor (10 tiers, gated by Armory)
| Tier | Item | DEF | Cost | Requires |
|------|------|-----|------|----------|
| 1 | Padded Armor | +19 | 9,500 | — |
| 2 | Leather Armor | +38 | 19,000 | — |
| 3 | Studded Leather | +75 | 37,500 | — |
| 4 | Bronze Chainmail | +120 | 60,000 | — |
| 5 | Iron Chainmail | +180 | 90,000 | — |
| 6 | Steel Chainmail | +250 | 125,000 | Armory Lv2 |
| 7 | Bronze Plate | +350 | 175,000 | Armory Lv2 |
| 8 | Iron Plate | +450 | 225,000 | Armory Lv3 |
| 9 | Steel Plate | +575 | 287,500 | Armory Lv4 |
| 10 | Mithril Plate | +750 | 375,000 | Armory Lv5 |

### Spy Offense Weapons (10 tiers, gated by Spy Academy)
| Tier | Item | SPY | Cost | Requires |
|------|------|-----|------|----------|
| 1 | Throwing Knife | +12 | 6,000 | — |
| 2 | Garrote Wire | +25 | 12,500 | — |
| 3 | Blowgun | +50 | 25,000 | — |
| 4 | Poison Dagger | +80 | 40,000 | — |
| 5 | Stiletto | +120 | 60,000 | — |
| 6 | Shadow Blade | +170 | 85,000 | Spy Academy Lv2 |
| 7 | Assassin Crossbow | +230 | 115,000 | Spy Academy Lv2 |
| 8 | Nightblade | +300 | 150,000 | Spy Academy Lv3 |
| 9 | Wrist Blade | +380 | 190,000 | Spy Academy Lv4 |
| 10 | Void Dagger | +480 | 240,000 | Spy Academy Lv5 |

### Spy Offense Armor (10 tiers, gated by Spy Academy)
| Tier | Item | SPY | Cost | Requires |
|------|------|-----|------|----------|
| 1 | Dark Cloak | +12 | 6,000 | — |
| 2 | Shadow Vest | +25 | 12,500 | — |
| 3 | Infiltrator Garb | +50 | 25,000 | — |
| 4 | Nightstalker Suit | +80 | 40,000 | — |
| 5 | Phantom Cloak | +120 | 60,000 | — |
| 6 | Assassin Leathers | +170 | 85,000 | Spy Academy Lv2 |
| 7 | Shadow Weave | +230 | 115,000 | Spy Academy Lv2 |
| 8 | Void Shroud | +300 | 150,000 | Spy Academy Lv3 |
| 9 | Wraithcloak | +380 | 190,000 | Spy Academy Lv4 |
| 10 | Shadowmeld Armor | +480 | 240,000 | Spy Academy Lv5 |

### Sentry Weapons (10 tiers, gated by Spy Academy)
| Tier | Item | SENTRY | Cost | Requires |
|------|------|--------|------|----------|
| 1 | Club | +12 | 6,000 | — |
| 2 | Hatchet | +25 | 12,500 | — |
| 3 | Mace | +50 | 25,000 | — |
| 4 | Morning Star | +80 | 40,000 | — |
| 5 | Flail | +120 | 60,000 | — |
| 6 | War Pick | +170 | 85,000 | Spy Academy Lv2 |
| 7 | Guard Pike | +230 | 115,000 | Spy Academy Lv2 |
| 8 | Sentinel Hammer | +300 | 150,000 | Spy Academy Lv3 |
| 9 | Inquisitor Blade | +380 | 190,000 | Spy Academy Lv4 |
| 10 | Nullifier | +480 | 240,000 | Spy Academy Lv5 |

### Sentry Armor (10 tiers, gated by Spy Academy)
| Tier | Item | SENTRY | Cost | Requires |
|------|------|--------|------|----------|
| 1 | Padded Guard Vest | +12 | 6,000 | — |
| 2 | Leather Guard Armor | +25 | 12,500 | — |
| 3 | Studded Guard Armor | +50 | 25,000 | — |
| 4 | Bronze Guard Plate | +80 | 40,000 | — |
| 5 | Iron Guard Plate | +120 | 60,000 | — |
| 6 | Steel Guard Plate | +170 | 85,000 | Spy Academy Lv2 |
| 7 | Warden Plate | +230 | 115,000 | Spy Academy Lv2 |
| 8 | Sentinel Bulwark | +300 | 150,000 | Spy Academy Lv3 |
| 9 | Inquisitor Shield | +380 | 190,000 | Spy Academy Lv4 |
| 10 | Aegis of Vigilance | +480 | 240,000 | Spy Academy Lv5 |

### Stat Scaling Summary
| Slot | Gate Building | Free tiers (1-5) | Gated tiers (6-10) |
|------|--------------|-------------------|---------------------|
| Off/Def Weapons | Armory | 25/50/100/150/200 | 275/350/450/550/700 |
| Off/Def Armor | Armory | 19/38/75/120/180 | 250/350/450/575/750 |
| Spy/Sentry Weapons | Spy Academy | 12/25/50/80/120 | 170/230/300/380/480 |
| Spy/Sentry Armor | Spy Academy | 12/25/50/80/120 | 170/230/300/380/480 |

---

## Progression Timeline (approximate)

### Early Game (Lvl 3-15)
- Mine Lv1 @ 3 (150K) — first income boost
- Housing Lv1 @ 3 (100K) — first citizen boost
- Spy School @ 5 (250K) — enables spy missions
- Merc Camp Lv1 @ 7 (200K) — daily mercs available
- Fortification Lv1 @ 10 (500K) — fort health
- Armory Lv1 @ 10 (750K) — item tiers 1-5
- **Mine Lv2 @ 12 (3.5M) — POWER SPIKE: Tier 2 workers**
- Housing Lv2 @ 13 (3M)
- Merc Camp Lv2 @ 14 (4.5M)
- Spy Academy Lv2 @ 15 (4M) — Tier 2 spies

### Mid Game (Lvl 20-50)
- Fortification Lv2 @ 20 (3M) — Tier 2 military
- Mine Lv3 @ 24 (60M) — Tier 3 workers
- **Armory Lv2 @ 30 (7M) — POWER SPIKE: item tiers 6-7**
- Spy Academy Lv3 @ 30 (70M)
- Housing Lv3 @ 33 (75M)
- Mine Lv4 @ 36 (800M)
- Fortification Lv3 @ 40 (80M) — Tier 3 military + Assassin/Inquisitor
- Spy Academy Lv4 @ 45 (250M)
- Mine Lv5 @ 48 (2B) — max income
- **Armory Lv3 @ 50 (35M) — item tier 8**

### Late Game (Lvl 60-93)
- Fortification Lv4 @ 60 (500M) — Tier 4 military (100 ATK/DEF units)
- Spy Academy Lv5 @ 60 (4.5B)
- Housing Lv4 @ 63 (550M)
- Armory Lv4 @ 70 (650M) — item tier 9
- Fortification Lv5 @ 80 (1B) — max fort
- Armory Lv5 @ 90 (2B) — item tier 10 (endgame gear)
- Housing Lv5 @ 93 (1.75B)

---

## What Changes in OpenThrone

### New
- `PlayerBuilding` table (player_id, building_type, level)
- Building definitions in `game-logic` with costs, level reqs, effects
- Unified `/buildings` page showing all buildings + upgrade buttons
- Building level checks in training (unit tier gating)
- Building level checks in armory (item tier gating)

### Reworked
- Unit types: expand from current simple tiers to building-gated tiers
- Item types: expand to 10 tiers per slot, gated by Armory level
- Fortification: becomes a building (not just a structure upgrade)
- Housing: becomes a building
- Mercenary: page hidden until Merc Camp Lv1 purchased

### Removed
- Separate structure upgrade pages → unified Buildings page
- Barracks concept (citizens come from housing + recruiting only)
- Current ad-hoc structure system from POC

---

## TODO: Design Decisions
- [ ] OpenThrone-flavored building/unit/item names (currently using DT reference names)
- [ ] Decide if "Barracks" is fully cut or repurposed into something else
- [ ] Define OpenThrone's identity/theme (see below)
- [ ] Alliance perk system design (Torn-style faction perks, war mode, collective achievements)
- [ ] Fort HP values per fortification level (DT reference didn't expose exact numbers)
- [ ] Spy Academy flat bonus values per level (shown as +5/+10, need Lv3-5)
- [ ] Housing citizens/day values per level (shown as +10/+20/+30, need to confirm Lv4-5)

## Theme / Identity Discussion

**The problem:** DarkThrone = dark medieval. Torn = crime & drugs. OpenThrone = ???

**"OpenThrone" as a concept:** The throne is open — contested, unclaimed, up for grabs.
This suggests a **political power struggle** theme rather than pure fantasy:
- You're not a hero or a villain — you're a **contender** building power
- Alliances aren't guilds — they're **factions** vying for influence
- Buildings aren't just upgrades — they're your growing **seat of power**
- The endgame isn't max level — it's **holding the throne**

Potential directions:
1. **Game of Thrones-style political intrigue** (without the IP) — houses, councils, betrayal
2. **Rise of an empire** — bronze age to iron age to golden age progression
3. **Faction warfare** — each alliance is a political movement, war mode = declaring your bid
4. **Something entirely different** — needs user input on vibe/feel
