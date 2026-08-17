import { z } from "zod";
import {
  Application,
  CoverLetter,
  CoverLetterTone,
  InterviewPrep,
} from "./application.ts";
import { JobAnalysis } from "./analysis.ts";
import { JobPosting } from "./job.ts";
import { Resume, ResumeProfile, ResumeVersion } from "./resume.ts";
import { Id } from "./common.ts";

export const ApiError = z.object({
  code: z.string(),
  message: z.string(),

  fields: z.record(z.string(), z.string()).optional(),
});
export type ApiError = z.infer<typeof ApiError>;

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; error: ApiError };

export function apiOk<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}
export function apiErr(
  code: string,
  message: string,
  fields?: Record<string, string>,
): ApiResult<never> {
  return {
    ok: false,
    error: fields ? { code, message, fields } : { code, message },
  };
}

export const ParseResumeRequest = z.object({
  fileName: z.string().min(1),
  fileType: z.enum(["pdf", "docx", "txt"]),

  text: z.string().min(1).max(400_000),
  useAI: z.boolean().default(false),
});
export type ParseResumeRequest = z.infer<typeof ParseResumeRequest>;

export const AnalyzeJobRequest = z.object({
  job: JobPosting.partial().required({ description: true }),
  resumeId: Id.optional(),
  profile: ResumeProfile.optional(),
  resumeText: z.string().max(400_000).optional(),
  useAI: z.boolean().default(false),
});
export type AnalyzeJobRequest = z.infer<typeof AnalyzeJobRequest>;

export const TailorResumeRequest = z.object({
  jobId: Id,
  resumeId: Id,
  analysisId: Id.optional(),

  acceptedRecommendations: z.array(Id).default([]),
  versionName: z.string().min(1).max(120),
});
export type TailorResumeRequest = z.infer<typeof TailorResumeRequest>;

export const CoverLetterRequest = z.object({
  jobId: Id,
  resumeId: Id,
  resumeVersionId: Id.nullable().default(null),
  tone: CoverLetterTone.default("professional"),
  extraContext: z.string().max(4000).default(""),
});
export type CoverLetterRequest = z.infer<typeof CoverLetterRequest>;

export const InterviewPrepRequest = z.object({
  jobId: Id,
  resumeId: Id,
  applicationId: Id.nullable().default(null),
});
export type InterviewPrepRequest = z.infer<typeof InterviewPrepRequest>;

export const CreateApplicationRequest = z.object({
  jobId: Id,
  status: Application.shape.status.optional(),
  resumeVersionId: Id.nullable().default(null),
  analysisId: Id.nullable().default(null),
  notes: z.string().max(20_000).default(""),
});
export type CreateApplicationRequest = z.infer<typeof CreateApplicationRequest>;

export const UpdateApplicationRequest = Application.partial().omit({
  id: true,
  createdAt: true,
});
export type UpdateApplicationRequest = z.infer<typeof UpdateApplicationRequest>;

export const SaveJobRequest = z.object({
  job: JobPosting.partial(),
  track: z.boolean().default(false),
});
export type SaveJobRequest = z.infer<typeof SaveJobRequest>;

export const ParseResumeResponse = z.object({ resume: Resume });
export const AnalyzeJobResponse = z.object({
  job: JobPosting,
  analysis: JobAnalysis,
});
export const TailorResumeResponse = z.object({
  version: ResumeVersion,

  changes: z.array(
    z.object({
      id: Id,
      section: z.string(),
      original: z.string(),
      suggested: z.string(),
      reason: z.string(),
      needsUserConfirmation: z.boolean().default(false),
    }),
  ),
});
export const CoverLetterResponse = z.object({ coverLetter: CoverLetter });
export const InterviewPrepResponse = z.object({ prep: InterviewPrep });

export type TailorChange = z.infer<
  typeof TailorResumeResponse
>["changes"][number];

export const AnalyticsResponse = z.object({
  totals: z.object({
    applications: z.number(),
    thisWeek: z.number(),
    interviews: z.number(),
    offers: z.number(),
    rejections: z.number(),
    savedJobs: z.number(),
  }),
  averageMatchScore: z.number().nullable(),
  responseRate: z.number(),
  interviewRate: z.number(),
  funnel: z.array(
    z.object({ stage: z.string(), label: z.string(), count: z.number() }),
  ),
  weekly: z.array(
    z.object({
      week: z.string(),
      applications: z.number(),
      interviews: z.number(),
      offers: z.number(),
      rejections: z.number(),
    }),
  ),
  scoreVsOutcome: z.array(
    z.object({
      bucket: z.string(),
      total: z.number(),
      advanced: z.number(),
      rate: z.number(),
    }),
  ),
  topCompanies: z.array(z.object({ name: z.string(), count: z.number() })),
  topTitles: z.array(z.object({ name: z.string(), count: z.number() })),
  skillGaps: z.array(
    z.object({
      skill: z.string(),
      jobsRequiring: z.number(),
      share: z.number(),
    }),
  ),
  highestMatches: z.array(
    z.object({
      id: Id,
      company: z.string(),
      title: z.string(),
      score: z.number(),
    }),
  ),
});
export type AnalyticsResponse = z.infer<typeof AnalyticsResponse>;
