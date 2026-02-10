import { Injectable } from '@nestjs/common';
import { prioritizeActions } from '@openthrone/game-logic';
import type { BotGameState, PrioritizedAction } from '@openthrone/game-logic';

@Injectable()
export class BotBrainService {
  /**
   * Decide which actions the bot should take this session.
   * Caps at 8-15 actions based on seeded randomness.
   */
  decideActions(
    strategy: string,
    state: BotGameState,
    seed: number,
  ): PrioritizedAction[] {
    const actions = prioritizeActions(
      strategy as any,
      state,
      seed + Date.now(),
    );

    // Cap actions per session: 8-15 based on seed
    const maxActions = 8 + (seed % 8);
    return actions.slice(0, maxActions);
  }
}
