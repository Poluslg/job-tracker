import { z } from 'zod';
import { Confidence, Id, Timestamped } from './common.ts';

export const MatchQuality = z.enum(['strong', 'partial', 'missing']);
export type MatchQuality = z.infer<typeof MatchQuality>;

export const SkillMatch = z.object({
  skill: z.string().min(1),
  quality: MatchQuality,
  required: z.boolean().default(false),
  
  resumeEvidence: z.array(z.string()).default([]),
  
  jobEvidence: z.array(z.string()).default([]),
  
  rationale: z.string().default(''),
});
export type SkillMatch = z.infer<typeof SkillMatch>;

export const KeywordStat = z.object({
  keyword: z.string(),
  inJob: z.number().default(0),
  inResume: z.number().default(0),
  important: z.boolean().default(false),
  
  unsupported: z.boolean().default(false),
});
export type KeywordStat = z.infer<typeof KeywordStat>;

export const AtsAnalysis = z.object({
  coverage: z.number().min(0).max(100),
  found: z.array(KeywordStat).default([]),
  missing: z.array(KeywordStat).default([]),
  titleAlignment: z.number().min(0).max(100).default(0),
  titleNote: z.string().default(''),
  issues: z.array(z.string()).default([]),
});
export type AtsAnalysis = z.infer<typeof AtsAnalysis>;

export const ScoreComponent = z.object({
  key: z.enum([
    'requiredSkills',
    'preferredSkills',
    'experience',
    'responsibilities',
    'keywords',
    'education',
    'domain',
  ]),
  label: z.string(),
  
  score: z.number().min(0).max(100),
  
  weight: z.number().min(0).max(1),
  
  explanation: z.string(),
  
  details: z.array(z.string()).default([]),
});
export type ScoreComponent = z.infer<typeof ScoreComponent>;

export const ScoreBreakdown = z.object({
  
  overall: z.number().min(0).max(100),
  components: z.array(ScoreComponent),
  
  engineVersion: z.string(),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdown>;

export const ExperienceAlignment = z.object({
  resumeYears: z.number().nullable().default(null),
  requiredYears: z.number().nullable().default(null),
  verdict: z.enum(['above', 'meets', 'near', 'below', 'unknown']).default('unknown'),
  note: z.string().default(''),
  relevantTitles: z.array(z.string()).default([]),
});
export type ExperienceAlignment = z.infer<typeof ExperienceAlignment>;

export const EducationAlignment = z.object({
  verdict: z.enum(['meets', 'partial', 'below', 'not-specified']).default('not-specified'),
  note: z.string().default(''),
  matchedCredentials: z.array(z.string()).default([]),
});
export type EducationAlignment = z.infer<typeof EducationAlignment>;

export const RecommendationKind = z.enum([
  'add-achievement',
  'clarify-responsibility',
  'improve-summary',
  'highlight-project',
  'reorder-skills',
  'remove-irrelevant',
  'add-terminology',
  'improve-bullet',
  'title-alignment',
]);
export type RecommendationKind = z.infer<typeof RecommendationKind>;

export const Recommendation = z.object({
  id: Id,
  kind: RecommendationKind,
  title: z.string(),
  detail: z.string(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  
  needsUserConfirmation: z.boolean().default(false),
});
export type Recommendation = z.infer<typeof Recommendation>;

export const Concern = z.object({
  text: z.string(),
  severity: z.enum(['high', 'medium', 'low']).default('medium'),
  
  inferred: z.boolean().default(true),
});
export type Concern = z.infer<typeof Concern>;

export const JobAnalysis = Timestamped.extend({
  id: Id,
  jobId: Id,
  resumeId: Id,
  resumeVersionId: Id.nullable().default(null),
  score: ScoreBreakdown,
  skills: z.array(SkillMatch).default([]),
  ats: AtsAnalysis,
  experience: ExperienceAlignment,
  education: EducationAlignment,
  recommendations: z.array(Recommendation).default([]),
  concerns: z.array(Concern).default([]),
  
  requirementCoverage: z.record(z.string(), MatchQuality).prefault({}),
  
  mode: z.enum(['local', 'ai-assisted', 'mock']).default('local'),
  modelUsed: z.string().default(''),
  promptVersion: z.string().default(''),
  confidence: Confidence.default('medium'),
});
export type JobAnalysis = z.infer<typeof JobAnalysis>;
