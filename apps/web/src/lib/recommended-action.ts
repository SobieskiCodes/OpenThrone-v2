import type { ComponentType } from 'react';
import {
  IconSwords,
  IconBolt,
  IconStar,
  IconArrowUp,
  IconWall,
  IconBuildingBank,
  IconTarget,
  IconTrophy,
  IconUsers,
} from '@tabler/icons-react';

export interface RecommendedAction {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ size?: number | string }>;
  color: string;
}

interface PlayerState {
  totalUnits: number;
  attackTurns: number;
  availablePoints: number;
  availableUpgrades: number;
  fortHpPercent: number;
  gold: number;
  goldInBank: number;
  totalItems: number;
  untrainedCitizens: number;
}

export function getRecommendedAction(state: PlayerState): RecommendedAction {
  if (state.totalUnits === 0) {
    return {
      title: 'Train your first soldiers',
      description: 'You have no units yet. Recruit and train troops to defend your kingdom.',
      href: '/battle/training',
      icon: IconSwords,
      color: 'red',
    };
  }

  if (state.untrainedCitizens > 0) {
    return {
      title: 'Train your idle citizens',
      description: `${state.untrainedCitizens.toLocaleString()} citizen${state.untrainedCitizens > 1 ? 's are' : ' is'} sitting idle. Put them to work!`,
      href: '/battle/training',
      icon: IconUsers,
      color: 'yellow',
    };
  }

  if (state.attackTurns > 50) {
    return {
      title: 'You have unused turns',
      description: `${state.attackTurns} attack turns are waiting. Find a target and put them to use!`,
      href: '/battle/players',
      icon: IconBolt,
      color: 'yellow',
    };
  }

  if (state.availablePoints > 0) {
    return {
      title: 'Allocate proficiency points',
      description: `You have ${state.availablePoints} unspent point${state.availablePoints > 1 ? 's' : ''}. Boost your strengths!`,
      href: '/battle/proficiencies',
      icon: IconStar,
      color: 'grape',
    };
  }

  if (state.availableUpgrades > 0) {
    return {
      title: 'New upgrades available',
      description: `${state.availableUpgrades} upgrade${state.availableUpgrades > 1 ? 's' : ''} ready to purchase. Strengthen your kingdom.`,
      href: '/structures/buildings',
      icon: IconArrowUp,
      color: 'blue',
    };
  }

  if (state.fortHpPercent < 50) {
    return {
      title: 'Your fort needs repairs',
      description: `Fort HP is at ${Math.round(state.fortHpPercent)}%. Repair it before the next attack.`,
      href: '/structures/repair',
      icon: IconWall,
      color: 'orange',
    };
  }

  if (state.gold > 100000 && state.gold > state.goldInBank) {
    return {
      title: 'Bank your gold',
      description: 'You have unbanked gold that enemies can steal. Deposit it for safety.',
      href: '/structures/bank',
      icon: IconBuildingBank,
      color: 'green',
    };
  }

  if (state.totalItems === 0) {
    return {
      title: 'Equip your troops',
      description: 'Your soldiers have no equipment. Visit the armory to gear them up.',
      href: '/structures/armory',
      icon: IconTarget,
      color: 'cyan',
    };
  }

  return {
    title: 'Find your next target',
    description: 'Check the rankings for worthy opponents to attack.',
    href: '/world/rankings',
    icon: IconTrophy,
    color: 'ot',
  };
}
