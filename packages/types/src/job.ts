import { z } from "zod";
import {
  Confidence,
  ExtractionSource,
  Id,
  IsoDate,
  Timestamped,
} from "./common.ts";

export const EmploymentType = z.enum([
  "full-time",
  "part-time",
  "contract",
  "internship",
  "temporary",
  "unknown",
]);
export type EmploymentType = z.infer<typeof EmploymentType>;

export const WorkArrangement = z.enum([
  "onsite",
  "hybrid",
  "remote",
  "unknown",
]);
export type WorkArrangement = z.infer<typeof WorkArrangement>;

export const SalaryInfo = z.object({
  min: z.number().nullable().default(null),
  max: z.number().nullable().default(null),
  currency: z.string().default(""),
  period: z
    .enum(["hour", "day", "month", "year", "unknown"])
    .default("unknown"),
  raw: z.string().default(""),
});
export type SalaryInfo = z.infer<typeof SalaryInfo>;

export const RequirementKind = z.enum([
  "must-have",
  "nice-to-have",
  "responsibility",
  "signal",
]);
export type RequirementKind = z.infer<typeof RequirementKind>;

export const JobRequirement = z.object({
  id: Id,
  text: z.string().min(1),
  kind: RequirementKind,

  skills: z.array(z.string()).default([]),

  yearsRequired: z.number().nullable().default(null),
  confidence: Confidence.default("medium"),
});
export type JobRequirement = z.infer<typeof JobRequirement>;

export const JobSourcePlatform = z.enum([
  "greenhouse",
  "lever",
  "workday",
  "linkedin",
  "indeed",
  "ashby",
  "smartrecruiters",
  "wellfound",
  "workable",
  "bamboohr",
  "jobvite",
  "icims",
  "taleo",
  "generic",
]);
export type JobSourcePlatform = z.infer<typeof JobSourcePlatform>;

export const JobPosting = Timestamped.extend({
  id: Id,
  title: z.string().default(""),
  company: z.string().default(""),
  location: z.string().default(""),
  employmentType: EmploymentType.default("unknown"),
  arrangement: WorkArrangement.default("unknown"),
  salary: SalaryInfo.prefault({}),
  description: z.string().default(""),
  requirements: z.array(JobRequirement).default([]),
  url: z.string().default(""),
  externalId: z.string().default(""),
  postedAt: z.string().default(""),
  platform: JobSourcePlatform.default("generic"),
  source: ExtractionSource.default("heuristic"),

  fieldSources: z.record(z.string(), ExtractionSource).prefault({}),

  fingerprint: z.string().default(""),
  capturedAt: IsoDate,
});
export type JobPosting = z.infer<typeof JobPosting>;

export const JobExtractionResult = z.object({
  ok: z.boolean(),
  job: JobPosting.partial().optional(),

  confidence: z.number().min(0).max(1).default(0),
  strategiesTried: z.array(z.string()).default([]),
  reason: z.string().default(""),
});
export type JobExtractionResult = z.infer<typeof JobExtractionResult>;
