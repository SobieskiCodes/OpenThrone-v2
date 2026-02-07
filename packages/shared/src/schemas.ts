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
  quantity: z.number().int().min(1),
});

export const repairFortSchema = z.object({
  points: z.number().int().min(1),
});

// ─── Alliance Schemas ────────────────────────────────────────────────

export const createAllianceSchema = z.object({
  name: z.string().min(3).max(50),
  motto: z.string().max(200).optional(),
  isPublic: z.boolean().default(true),
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
export type RepairFortDto = z.infer<typeof repairFortSchema>;
export type CreateAllianceDto = z.infer<typeof createAllianceSchema>;
export type SendMessageDto = z.infer<typeof sendMessageSchema>;
export type CreateChatRoomDto = z.infer<typeof createChatRoomSchema>;
