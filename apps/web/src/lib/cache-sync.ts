import type { QueryClient } from '@tanstack/react-query';
import type { PlayerStateSnapshot } from '@openthrone/shared';

/**
 * Updates React Query cache with fresh player state from mutation responses.
 * Prevents stale data without additional refetches.
 */
export function updatePlayerCache(
  queryClient: QueryClient,
  snapshot: PlayerStateSnapshot,
) {
  // Update player profile (for header stats)
  queryClient.setQueryData(['player', 'profile'], (old: any) => {
    if (!old) return old;
    return {
      ...old,
      experience: snapshot.experience,
      level: snapshot.level,
      citizens: snapshot.citizens,
      attack_turns: snapshot.attackTurns,
    };
  });

  // Update economy
  queryClient.setQueryData(['economy', 'status'], (old: any) => {
    if (!old) return old;
    return {
      ...old,
      gold: snapshot.gold,
      goldInBank: snapshot.goldInBank,
      attackTurns: snapshot.attackTurns,
    };
  });

  // Update stats
  queryClient.setQueryData(['player', 'stats'], (old: any) => {
    if (!old) return old;
    return {
      ...old,
      offense: snapshot.offense,
      defense: snapshot.defense,
      spy: snapshot.spy,
      sentry: snapshot.sentry,
      experience: snapshot.experience,
      level: snapshot.level,
    };
  });

  // Update units if included
  if (snapshot.updatedUnits) {
    queryClient.setQueryData(['units', 'status'], (old: any) => {
      if (!old) return old;
      const updated = { ...old };
      snapshot.updatedUnits!.forEach((unit) => {
        const key = `${unit.unitType}_${unit.level}`;
        updated[key] = unit.quantity;
      });
      return updated;
    });
  }
}
