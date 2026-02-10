import { z } from 'zod';
import {
  PlayerRace,
  PlayerClass,
  UnitType,
  ItemType,
  ItemUsage,
  BonusType,
  BattleUpgradeType,
  StructureUpgradeType,
  Locale,
  SocialRelationshipType,
  AccountStatus,
  PermissionType,
  SpyMissionType,
  BotStrategy,
  BotActionType,
  ActivityType,
} from './enums';

// ─── Auth Schemas ────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email(),
  displayName: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, underscores, and hyphens'),
  password: z.string().min(8).max(128),
  race: z.nativeEnum(PlayerRace),
  class: z.nativeEnum(PlayerClass),
  locale: z.nativeEnum(Locale).default(Locale.EN_US),
  captchaToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  captchaToken: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

// ─── Player Schemas ──────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  colorScheme: z.string().max(50).optional(),
  locale: z.nativeEnum(Locale).optional(),
  avatar: z.string().max(255).optional(),
});

export const allocateBonusPointsSchema = z.object({
  bonusType: z.nativeEnum(BonusType),
});

// ─── Training Schemas ────────────────────────────────────────────────

export const trainUnitsSchema = z.object({
  units: z.array(
    z.object({
      unitType: z.nativeEnum(UnitType),
      level: z.number().int().min(1),
      quantity: z.number().int().min(1),
    }),
  ),
});

export const untrainUnitsSchema = z.object({
  units: z.array(
    z.object({
      unitType: z.nativeEnum(UnitType),
      level: z.number().int().min(1),
      quantity: z.number().int().min(1),
    }),
  ),
});

export const convertUnitsSchema = z.object({
  fromType: z.nativeEnum(UnitType),
  fromLevel: z.number().int().min(1),
  toType: z.nativeEnum(UnitType),
  toLevel: z.number().int().min(1),
  quantity: z.number().int().min(1),
});

// ─── Bank Schemas ────────────────────────────────────────────────────

export const bankDepositSchema = z.object({
  amount: z.string().regex(/^\d+$/, 'Must be a positive integer string'),
});

export const bankWithdrawSchema = z.object({
  amount: z.string().regex(/^\d+$/, 'Must be a positive integer string'),
});

// ─── Armory Schemas ──────────────────────────────────────────────────

export const equipItemSchema = z.object({
  itemType: z.nativeEnum(ItemType),
  usage: z.nativeEnum(ItemUsage),
  level: z.number().int().min(1),
  quantity: z.number().int().min(1),
});

export const unequipItemSchema = z.object({
  itemType: z.nativeEnum(ItemType),
  usage: z.nativeEnum(ItemUsage),
  level: z.number().int().min(1),
  quantity: z.number().int().min(1),
});

// ─── Structure Schemas ───────────────────────────────────────────────

export const purchaseStructureUpgradeSchema = z.object({
  upgradeType: z.nativeEnum(StructureUpgradeType),
});

export const purchaseBattleUpgradeSchema = z.object({
  upgradeType: z.nativeEnum(BattleUpgradeType),
  level: z.number().int().min(1),
  quantity: z.number().int().min(1),
});

export const sellBattleUpgradeSchema = z.object({
  upgradeType: z.nativeEnum(BattleUpgradeType),
  level: z.number().int().min(1),
  quantity: z.number().int().min(1),
});

export const repairFortSchema = z.object({
  points: z.number().int().min(1),
});

export const buyMercenarySchema = z.object({
  units: z.array(z.object({
    unitType: z.enum(['OFFENSE', 'DEFENSE', 'SPY', 'SENTRY']),
    quantity: z.number().int().min(1).max(100),
  })).min(1),
});

// ─── Recruitment Schemas ─────────────────────────────────────────────

export const claimRecruitLinkSchema = z.object({
  captchaToken: z.string().optional(),
});

// ─── Social Schemas ─────────────────────────────────────────────────

export const addFriendSchema = z.object({
  friendId: z.string(),
  relationshipType: z.nativeEnum(SocialRelationshipType),
});

export const respondToRequestSchema = z.object({
  requestId: z.number().int(),
  accept: z.boolean(),
});

// ─── Alliance Schemas ────────────────────────────────────────────────

export const createAllianceSchema = z.object({
  name: z.string().min(3).max(50),
  motto: z.string().max(200).optional(),
  isPublic: z.boolean().default(true),
});

export const updateAllianceSchema = z.object({
  motto: z.string().max(200).optional(),
  isPublic: z.boolean().optional(),
  closedEnrollment: z.boolean().optional(),
});

export const allianceDepositSchema = z.object({
  amount: z.string().regex(/^\d+$/, 'Must be a positive integer string'),
});

// ─── Mail Schemas ───────────────────────────────────────────────────

export const sendMailSchema = z.object({
  recipientId: z.string(),
  subject: z.string().min(1).max(100),
  body: z.string().min(1).max(5000),
});

// ─── Chat Schemas ────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  replyToMessageId: z.number().int().optional(),
});

export const createChatRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  participantIds: z.array(z.string()),
  isPrivate: z.boolean().default(true),
});

export const addParticipantsSchema = z.object({
  participantIds: z.array(z.string()),
});

export const addReactionSchema = z.object({
  messageId: z.number().int(),
  reaction: z.string().max(10),
});

export const removeReactionSchema = z.object({
  messageId: z.number().int(),
  reaction: z.string(),
});

export const markMessagesAsReadSchema = z.object({
  messageIds: z.array(z.number().int()),
});

// ─── Admin Schemas ──────────────────────────────────────────────────

export const adminUpdatePlayerSchema = z.object({
  gold: z.string().regex(/^\d+$/).optional(),
  attackTurns: z.number().int().min(0).optional(),
  status: z.nativeEnum(AccountStatus).optional(),
  experience: z.number().int().min(0).optional(),
  offense: z.number().int().min(0).optional(),
  defense: z.number().int().min(0).optional(),
  spy: z.number().int().min(0).optional(),
  sentry: z.number().int().min(0).optional(),
  bonusPoints: z.record(z.string(), z.number().int().min(0).max(75)).optional(),
});

export const adminAccountActionSchema = z.object({
  action: z.enum(['BAN', 'SUSPEND', 'CLOSE', 'ACTIVATE', 'VACATION', 'TIMEOUT']),
  duration: z.number().int().min(1).optional(),
  reason: z.string().max(500).optional(),
});

export const adminGrantPermissionSchema = z.object({
  playerId: z.string(),
  permissionType: z.nativeEnum(PermissionType),
});

// ─── Battle Schemas ─────────────────────────────────────────────────

export const battlePlayersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().max(50).optional(),
  race: z.nativeEnum(PlayerRace).optional(),
  class: z.nativeEnum(PlayerClass).optional(),
  sort: z.enum(['rank', 'gold', 'level', 'population', 'fortLevel', 'displayName', 'attacksToday']).default('rank'),
  order: z.enum(['asc', 'desc']).default('asc'),
  inRange: z.coerce.boolean().optional(),
  botFilter: z.enum(['all', 'bots', 'humans']).optional(),
});

export const battleRankingsQuerySchema = z.object({
  type: z.enum(['overall', 'offense', 'defense', 'spy', 'sentry']).default('overall'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const detailedRankingsQuerySchema = z.object({
  category: z.enum(['global', 'combat', 'spy', 'economy', 'army', 'social']).default('global'),
  subType: z.string().default('overall_power'),
  period: z.enum(['allTime', 'today']).default('allTime'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const battleHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  type: z.enum(['all', 'attack', 'defense', 'spy']).default('all'),
});

// ─── Combat Schemas ─────────────────────────────────────────────────

export const attackSchema = z.object({
  turns: z.number().int().min(1).max(10).default(1),
});

export const spyMissionSchema = z.object({
  type: z.nativeEnum(SpyMissionType),
  spiesSent: z.number().int().min(1).max(10),
  targetUnitType: z.nativeEnum(UnitType).optional(),
});

export const combatSimProfileSchema = z.object({
  offense: z.number().int().min(0),
  defense: z.number().int().min(0),
  spy: z.number().int().min(0),
  sentry: z.number().int().min(0),
  gold: z.number().int().min(0),
  goldInBank: z.number().int().min(0).default(0),
  fortLevel: z.number().int().min(1).max(24),
  fortHitpoints: z.number().int().min(0),
  level: z.number().int().min(1),
  population: z.number().int().min(0).default(100),
  offenseUnits: z.number().int().min(0).default(0),
  defenseUnits: z.number().int().min(0).default(0),
  spyUnits: z.number().int().min(0).default(0),
  sentryUnits: z.number().int().min(0).default(0),
  citizenUnits: z.number().int().min(0).default(0),
});

export const combatSimulateSchema = z.object({
  attacker: z.union([z.object({ playerId: z.string() }), combatSimProfileSchema]),
  defender: z.union([z.object({ playerId: z.string() }), combatSimProfileSchema]),
  config: z.record(z.number()).optional(),
  runs: z.number().int().min(1).max(10000).default(1000),
  type: z.enum(['attack', 'intel', 'assassinate', 'infiltrate']).default('attack'),
  options: z.object({
    spiesSent: z.number().int().min(1).max(10).optional(),
    targetUnitType: z.nativeEnum(UnitType).optional(),
  }).optional(),
});

// ─── Intel Sharing Schemas ──────────────────────────────────────────

export const shareIntelSchema = z.object({
  attackLogId: z.number().int(),
});

// ─── Bot Schemas ────────────────────────────────────────────────────

export const createBotSchema = z.object({
  displayName: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, underscores, and hyphens'),
  race: z.nativeEnum(PlayerRace),
  class: z.nativeEnum(PlayerClass),
  strategy: z.nativeEnum(BotStrategy),
  sessionsPerDay: z.number().int().min(1).max(5).default(3),
  notes: z.string().max(500).optional(),
});

export const updateBotSchema = z.object({
  strategy: z.nativeEnum(BotStrategy).optional(),
  isActive: z.boolean().optional(),
  sessionsPerDay: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(500).optional(),
});

export const botActionLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  actionType: z.nativeEnum(BotActionType).optional(),
  sessionId: z.string().optional(),
});

// ─── Activity Feed Schemas ──────────────────────────────────────────

export const activityFeedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  type: z.nativeEnum(ActivityType).optional(),
  direction: z.enum(['all', 'outgoing', 'incoming']).default('all'),
});

// ─── Inferred Types ──────────────────────────────────────────────────

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type AllocateBonusPointsDto = z.infer<typeof allocateBonusPointsSchema>;
export type TrainUnitsDto = z.infer<typeof trainUnitsSchema>;
export type UntrainUnitsDto = z.infer<typeof untrainUnitsSchema>;
export type ConvertUnitsDto = z.infer<typeof convertUnitsSchema>;
export type BankDepositDto = z.infer<typeof bankDepositSchema>;
export type BankWithdrawDto = z.infer<typeof bankWithdrawSchema>;
export type EquipItemDto = z.infer<typeof equipItemSchema>;
export type UnequipItemDto = z.infer<typeof unequipItemSchema>;
export type PurchaseStructureUpgradeDto = z.infer<typeof purchaseStructureUpgradeSchema>;
export type PurchaseBattleUpgradeDto = z.infer<typeof purchaseBattleUpgradeSchema>;
export type SellBattleUpgradeDto = z.infer<typeof sellBattleUpgradeSchema>;
export type RepairFortDto = z.infer<typeof repairFortSchema>;
export type BuyMercenaryDto = z.infer<typeof buyMercenarySchema>;
export type ClaimRecruitLinkDto = z.infer<typeof claimRecruitLinkSchema>;
export type AddFriendDto = z.infer<typeof addFriendSchema>;
export type RespondToRequestDto = z.infer<typeof respondToRequestSchema>;
export type CreateAllianceDto = z.infer<typeof createAllianceSchema>;
export type UpdateAllianceDto = z.infer<typeof updateAllianceSchema>;
export type AllianceDepositDto = z.infer<typeof allianceDepositSchema>;
export type SendMailDto = z.infer<typeof sendMailSchema>;
export type SendMessageDto = z.infer<typeof sendMessageSchema>;
export type CreateChatRoomDto = z.infer<typeof createChatRoomSchema>;
export type AddParticipantsDto = z.infer<typeof addParticipantsSchema>;
export type AddReactionDto = z.infer<typeof addReactionSchema>;
export type RemoveReactionDto = z.infer<typeof removeReactionSchema>;
export type MarkMessagesAsReadDto = z.infer<typeof markMessagesAsReadSchema>;
export type AdminUpdatePlayerDto = z.infer<typeof adminUpdatePlayerSchema>;
export type AdminAccountActionDto = z.infer<typeof adminAccountActionSchema>;
export type AdminGrantPermissionDto = z.infer<typeof adminGrantPermissionSchema>;
export type BattlePlayersQueryDto = z.infer<typeof battlePlayersQuerySchema>;
export type BattleRankingsQueryDto = z.infer<typeof battleRankingsQuerySchema>;
export type DetailedRankingsQueryDto = z.infer<typeof detailedRankingsQuerySchema>;
export type BattleHistoryQueryDto = z.infer<typeof battleHistoryQuerySchema>;
export type AttackDto = z.infer<typeof attackSchema>;
export type SpyMissionDto = z.infer<typeof spyMissionSchema>;
export type CombatSimulateDto = z.infer<typeof combatSimulateSchema>;
export type CombatSimProfileDto = z.infer<typeof combatSimProfileSchema>;
export type ShareIntelDto = z.infer<typeof shareIntelSchema>;
export type CreateBotDto = z.infer<typeof createBotSchema>;
export type UpdateBotDto = z.infer<typeof updateBotSchema>;
export type BotActionLogsQueryDto = z.infer<typeof botActionLogsQuerySchema>;
export type ActivityFeedQueryDto = z.infer<typeof activityFeedQuerySchema>;
