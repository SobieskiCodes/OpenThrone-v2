# OpenThrone — Backlog

Feature ideas, bug notes, and design thoughts. Roughly prioritized by section.

---

## Combat / Balance

- [ ] Casualties feel too high at 10x turns — needs tuning
- [ ] Spies should have a chance to fail based on a ratio (e.g., if defender has < 2x spy defense, attacker still has some failure chance) — needs design pass
- [ ] Sabotage destroying 3–5 items is negligible mid-game (less than a turn of gold) — should be percentage-based instead of flat count

## Profiles

## Battle

## Navigation / Notifications

- [ ] the server/tick time should be in a menu / side bar visible on all screens imo.

## Dashboard

## UX / Performance

## Leaderboard

## Chat

- [ ] Admins/mods can mute players at or below their rank
- [ ] Admins can create new chat rooms
- [ ] All players auto-join "General" on first login (can leave if they want)
- [ ] Evaluate feasibility of persistent chat rooms vs ephemeral

## Alliances

- [ ] Alliance member cap? (prevents mega-alliances, forces politics)
- [ ] Alliance gold vault — deposit gold that's 100% safe from raids but inaccessible to the depositor
  - Creates incentive for "war chests" and alliance-level strategy
  - Could fund alliance features (bounties, contracts)
  - Must not block solo player progression
- [ ] **Alliance contracts** — clans post bounties/missions, individuals or other clans accept them, game handles tracking and payment on completion


## Admin / Infrastructure

- [ ] **API Key Authentication**
  - Allow ADMINISTRATOR users to generate API keys for programmatic access
  - Keys are tied to a user account
  - Admin dashboard UI to:
    - Generate new keys (shown only once)
    - List all keys with name, created date, last used
    - Enable/disable keys
    - Delete keys permanently
  - Auth flow: Check `X-API-Key` header, validate against hashed keys in DB
  - Optional: Scope permissions per key (read-only, admin, specific endpoints)
  - Use case: External scripts, admin tools, data analysis, testing
  - DB model: `ApiKey` (id, name, key_hash, player_id, permissions[], enabled, created_at, last_used, expires_at)


## Future Ideas
- [ ] Specialization trees (warlord / economist / spymaster)
- [ ] "Business mode"

## Proficiencies

- [ ] They need a limit, I propose 25 but am open to 50.
--  my concern with this one is 50% reduction in armory prices is huge (100% even more so:P)

## ADD to todo
i might consider something like a retail bonus later it would only show up in the alliance feed for ~10m with a "retaliate" button which has some type of bonus to it - either reward or damage

alliances should function sim to torn with war perks / ability to increase perks with member achivments ie 10k spies = level 1 +1% spy bonus for clan (maybe some gold too)

ai could join clans - or a clan (bot clan?) - could be a setting for the clan - allow registration -> allow bots to join -> auto accept option in general (unrelated)


https://github.com/Rihoj/dtg-recruit

spy calcs: 
https://discord.com/channels/1210025164985864234/1450488850001694750/1466066344331186239

barracks is citizen per tick - maybe?

should level play a small role in over all power? it coulda kinda discourage level holding

Should we add a player compare rankings thing

Fort repair button on dashboard

Upgrade button in armory, higher tier items should take equip precendence

need to keep track of which pages need to return cache - its still annoying as shit.


can this be ported to a mobile app - or do we need to revist the design lol

admin ui can set starting gold in bank + cits per turn (and any otehr configurable)