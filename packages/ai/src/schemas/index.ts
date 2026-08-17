import { z } from 'zod';

export const AIJobExtraction = z.object({
  title: z.string().default(''),
  company: z.string().default(''),
  location: z.string().default(''),
  employmentType: z
    .enum(['full-time', 'part-time', 'contract', 'internship', 'temporary', 'unknown'])
    .default('unknown'),
  arrangement: z.enum(['onsite', 'hybrid', 'remote', 'unknown']).default('unknown'),
  salaryText: z.string().default(''),
  isJobPosting: z.boolean().default(false),
});
export type AIJobExtraction = z.infer<typeof AIJobExtraction>;

export const AIRequirement = z.object({
  text: z.string().min(1),
  kind: z.enum(['must-have', 'nice-to-have', 'responsibility', 'signal']),
  skills: z.array(z.string()).default([]),
  yearsRequired: z.number().nullable().default(null),
});

export const AIRequirements = z.object({
  requirements: z.array(AIRequirement).max(60).default([]),
});
export type AIRequirements = z.infer<typeof AIRequirements>;

export const AIResumeParse = z.object({
  contact: z
    .object({
      name: z.string().default(''),
      email: z.string().default(''),
      phone: z.string().default(''),
      location: z.string().default(''),
      linkedin: z.string().default(''),
      github: z.string().default(''),
      portfolio: z.string().default(''),
    })
    .prefault({}),
  summary: z.string().default(''),
  skills: z.array(z.string()).max(120).default([]),
  experience: z
    .array(
      z.object({
        title: z.string().default(''),
        company: z.string().default(''),
        location: z.string().default(''),
        startDate: z.string().default(''),
        endDate: z.string().default(''),
        current: z.boolean().default(false),
        responsibilities: z.array(z.string()).default([]),
        achievements: z.array(z.string()).default([]),
      }),
    )
    .max(30)
    .default([]),
  education: z
    .array(
      z.object({
        degree: z.string().default(''),
        field: z.string().default(''),
        institution: z.string().default(''),
        startDate: z.string().default(''),
        endDate: z.string().default(''),
      }),
    )
    .max(15)
    .default([]),
  certifications: z.array(z.object({ name: z.string(), issuer: z.string().default('') })).max(30).default([]),
  projects: z
    .array(
      z.object({
        name: z.string().default(''),
        description: z.string().default(''),
        technologies: z.array(z.string()).default([]),
      }),
    )
    .max(20)
    .default([]),
  languages: z.array(z.string()).max(20).default([]),
});
export type AIResumeParse = z.infer<typeof AIResumeParse>;

export const AIMatchInsights = z.object({
  
  hiddenSignals: z
    .array(z.object({ text: z.string(), why: z.string().default('') }))
    .max(8)
    .default([]),
  concerns: z
    .array(
      z.object({
        text: z.string(),
        severity: z.enum(['high', 'medium', 'low']).default('medium'),
      }),
    )
    .max(8)
    .default([]),
  recommendations: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        priority: z.enum(['high', 'medium', 'low']).default('medium'),
        
        needsUserConfirmation: z.boolean().default(true),
      }),
    )
    .max(10)
    .default([]),
  
  terminologyBridges: z
    .array(z.object({ jobTerm: z.string(), resumeTerm: z.string(), note: z.string().default('') }))
    .max(10)
    .default([]),
});
export type AIMatchInsights = z.infer<typeof AIMatchInsights>;

export const AITailorChange = z.object({
  section: z.string(),
  original: z.string().default(''),
  suggested: z.string(),
  reason: z.string().default(''),
  
  needsUserConfirmation: z.boolean().default(false),
});

export const AITailorResume = z.object({
  summary: z.string().default(''),
  skillOrder: z.array(z.string()).max(60).default([]),
  changes: z.array(AITailorChange).max(30).default([]),
  
  unverifiable: z.array(z.string()).max(20).default([]),
});
export type AITailorResume = z.infer<typeof AITailorResume>;

export const AICoverLetter = z.object({
  body: z.string().min(1),
  needsConfirmation: z.array(z.string()).max(15).default([]),
});
export type AICoverLetter = z.infer<typeof AICoverLetter>;

export const AIInterviewPrep = z.object({
  questions: z
    .array(
      z.object({
        category: z.enum(['technical', 'behavioral', 'resume-based', 'company-role']),
        question: z.string().min(1),
        answerFramework: z.string().default(''),
        drawFrom: z.array(z.string()).default([]),
        difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
      }),
    )
    .max(40)
    .default([]),
  talkingPoints: z.array(z.string()).max(15).default([]),
  questionsToAsk: z.array(z.string()).max(15).default([]),
  studyTopics: z.array(z.string()).max(20).default([]),
});
export type AIInterviewPrep = z.infer<typeof AIInterviewPrep>;

export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
}
