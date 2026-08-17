import { z } from 'zod';
import { AIProviderConfig } from './ai.ts';
import { Id, IsoDate, Timestamped } from './common.ts';

export const AuthMode = z.enum(['guest', 'account']);
export type AuthMode = z.infer<typeof AuthMode>;

export const User = Timestamped.extend({
  id: Id,
  email: z.string().email(),
  name: z.string().default(''),
  
  authProvider: z.enum(['password', 'google', 'github']).default('password'),
});
export type User = z.infer<typeof User>;

export const Session = z.object({
  userId: Id,
  email: z.string(),
  name: z.string().default(''),
  expiresAt: IsoDate,
});
export type Session = z.infer<typeof Session>;

export const PrivacySettings = z.object({
  
  syncEnabled: z.boolean().default(false),
  
  redactContactInfo: z.boolean().default(true),
  
  shareAnonymousUsage: z.boolean().default(false),
  
  storeJobSnapshots: z.boolean().default(true),
});
export type PrivacySettings = z.infer<typeof PrivacySettings>;

export const UiSettings = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  
  showFloatingButton: z.boolean().default(true),
  
  autoAnalyze: z.boolean().default(false),
  compactPopup: z.boolean().default(false),
});
export type UiSettings = z.infer<typeof UiSettings>;

export const ScoringWeights = z.object({
  requiredSkills: z.number().min(0).max(1).default(0.3),
  preferredSkills: z.number().min(0).max(1).default(0.15),
  experience: z.number().min(0).max(1).default(0.2),
  responsibilities: z.number().min(0).max(1).default(0.15),
  keywords: z.number().min(0).max(1).default(0.1),
  education: z.number().min(0).max(1).default(0.05),
  domain: z.number().min(0).max(1).default(0.05),
});
export type ScoringWeights = z.infer<typeof ScoringWeights>;

export const UserSettings = z.object({
  authMode: AuthMode.default('guest'),
  ai: AIProviderConfig.prefault({}),
  privacy: PrivacySettings.prefault({}),
  ui: UiSettings.prefault({}),
  scoring: ScoringWeights.prefault({}),
  
  demoMode: z.boolean().default(false),
  onboardingCompletedAt: IsoDate.nullable().default(null),
});
export type UserSettings = z.infer<typeof UserSettings>;

export const DEFAULT_SETTINGS: UserSettings = UserSettings.parse({});
