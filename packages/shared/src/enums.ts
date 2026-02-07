export enum PlayerRace {
  UNDEAD = 'UNDEAD',
  HUMAN = 'HUMAN',
  GOBLIN = 'GOBLIN',
  ELF = 'ELF',
}

export enum PlayerClass {
  FIGHTER = 'FIGHTER',
  CLERIC = 'CLERIC',
  ASSASSIN = 'ASSASSIN',
  THIEF = 'THIEF',
}

export enum UnitType {
  CITIZEN = 'CITIZEN',
  WORKER = 'WORKER',
  OFFENSE = 'OFFENSE',
  DEFENSE = 'DEFENSE',
  SPY = 'SPY',
  SENTRY = 'SENTRY',
}

export enum ItemType {
  WEAPON = 'WEAPON',
  HELM = 'HELM',
  ARMOR = 'ARMOR',
  BOOTS = 'BOOTS',
  BRACERS = 'BRACERS',
  SHIELD = 'SHIELD',
}

export enum ItemUsage {
  OFFENSE = 'OFFENSE',
  DEFENSE = 'DEFENSE',
  SPY = 'SPY',
  SENTRY = 'SENTRY',
}

export enum BonusType {
  OFFENSE = 'OFFENSE',
  DEFENSE = 'DEFENSE',
  RECRUITING = 'RECRUITING',
  CASUALTY = 'CASUALTY',
  INTEL = 'INTEL',
  INCOME = 'INCOME',
  PRICES = 'PRICES',
}

export enum BattleUpgradeType {
  OFFENSE = 'OFFENSE',
  DEFENSE = 'DEFENSE',
  SPY = 'SPY',
  SENTRY = 'SENTRY',
}

export enum StructureUpgradeType {
  OFFENSE = 'OFFENSE',
  SPY = 'SPY',
  SENTRY = 'SENTRY',
  ARMORY = 'ARMORY',
  ECONOMY = 'ECONOMY',
  HOUSE = 'HOUSE',
  FORT = 'FORT',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  VACATION = 'VACATION',
  CLOSED = 'CLOSED',
  IDLE = 'IDLE',
  RESET = 'RESET',
  BANNED = 'BANNED',
  TIMEOUT = 'TIMEOUT',
  SUSPENDED = 'SUSPENDED',
}

export enum PermissionType {
  ADMINISTRATOR = 'ADMINISTRATOR',
  MODERATOR = 'MODERATOR',
}

export enum ChatRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum BankAccountType {
  HAND = 'HAND',
  BANK = 'BANK',
}

export enum BankTransferHistoryType {
  ECONOMY = 'ECONOMY',
  PLAYER_TRANSFER = 'PLAYER_TRANSFER',
  WAR_SPOILS = 'WAR_SPOILS',
  SALE = 'SALE',
  RECRUITMENT = 'RECRUITMENT',
  FORT_REPAIR = 'FORT_REPAIR',
  DAILY_RECRUIT = 'DAILY_RECRUIT',
}

export enum Locale {
  EN_US = 'en-US',
  ES_ES = 'es-ES',
}

export enum SocialRelationshipType {
  FRIEND = 'FRIEND',
  ALLY = 'ALLY',
  ENEMY = 'ENEMY',
}

export enum SocialStatus {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  ENDED = 'ENDED',
}
