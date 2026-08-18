import { z } from "zod";
import { Id, IsoDate, Timestamped } from "./common.ts";

export const APPLICATION_STATUSES = [
  "saved",
  "preparing",
  "applied",
  "recruiter-screen",
  "interview",
  "technical-round",
  "final-round",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export const ApplicationStatus = z.enum(APPLICATION_STATUSES);
export type ApplicationStatus = z.infer<typeof ApplicationStatus>;

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  preparing: "Preparing",
  applied: "Applied",
  "recruiter-screen": "Recruiter Screen",
  interview: "Interview",
  "technical-round": "Technical Round",
  "final-round": "Final Round",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const FUNNEL_STAGES: ApplicationStatus[] = [
  "saved",
  "preparing",
  "applied",
  "recruiter-screen",
  "interview",
  "technical-round",
  "final-round",
  "offer",
];

export const TERMINAL_STATUSES: ApplicationStatus[] = ["rejected", "withdrawn"];

export const Contact = z.object({
  name: z.string().default(""),
  role: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  linkedin: z.string().default(""),
});
export type Contact = z.infer<typeof Contact>;

export const ApplicationEvent = z.object({
  id: Id,
  at: IsoDate,
  type: z.enum(["status-change", "note", "interview", "follow-up"]),
  from: ApplicationStatus.nullable().default(null),
  to: ApplicationStatus.nullable().default(null),
  text: z.string().default(""),
});
export type ApplicationEvent = z.infer<typeof ApplicationEvent>;

export const Application = Timestamped.extend({
  id: Id,
  jobId: Id,
  status: ApplicationStatus.default("saved"),

  company: z.string().default(""),
  title: z.string().default(""),
  url: z.string().default(""),
  location: z.string().default(""),
  salary: z.string().default(""),
  jobType: z.string().default(""),
  matchScore: z.number().min(0).max(100).nullable().default(null),
  analysisId: Id.nullable().default(null),
  resumeVersionId: Id.nullable().default(null),
  resumeVersionName: z.string().default(""),
  coverLetterId: Id.nullable().default(null),
  interviewPrepId: Id.nullable().default(null),
  discoveredAt: IsoDate,
  appliedAt: IsoDate.nullable().default(null),
  nextInterviewAt: IsoDate.nullable().default(null),
  followUpAt: IsoDate.nullable().default(null),
  recruiter: Contact.prefault({}),
  notes: z.string().default(""),

  jobDescriptionSnapshot: z.string().default(""),
  timeline: z.array(ApplicationEvent).default([]),
});
export type Application = z.infer<typeof Application>;

export const CoverLetterTone = z.enum([
  "professional",
  "concise",
  "enthusiastic",
  "technical",
  "startup",
  "corporate",
]);
export type CoverLetterTone = z.infer<typeof CoverLetterTone>;

export const CoverLetter = Timestamped.extend({
  id: Id,
  jobId: Id,
  resumeVersionId: Id.nullable().default(null),
  company: z.string().default(""),
  title: z.string().default(""),
  tone: CoverLetterTone.default("professional"),
  body: z.string().default(""),

  needsConfirmation: z.array(z.string()).default([]),
  edited: z.boolean().default(false),
});
export type CoverLetter = z.infer<typeof CoverLetter>;

export const InterviewQuestion = z.object({
  id: Id,
  category: z.enum(["technical", "behavioral", "resume-based", "company-role"]),
  question: z.string(),

  answerFramework: z.string().default(""),

  drawFrom: z.array(z.string()).default([]),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});
export type InterviewQuestion = z.infer<typeof InterviewQuestion>;

export const InterviewPrep = Timestamped.extend({
  id: Id,
  jobId: Id,
  applicationId: Id.nullable().default(null),
  questions: z.array(InterviewQuestion).default([]),
  talkingPoints: z.array(z.string()).default([]),
  questionsToAsk: z.array(z.string()).default([]),
  studyTopics: z.array(z.string()).default([]),
  notes: z.string().default(""),

  completed: z.array(Id).default([]),
});
export type InterviewPrep = z.infer<typeof InterviewPrep>;
