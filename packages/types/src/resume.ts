import { z } from 'zod';
import { Id, IsoDate, Timestamped } from './common.ts';

export const SkillCategory = z.enum([
  'technical',
  'soft',
  'tool',
  'language',
  'domain',
  'certification',
  'other',
]);
export type SkillCategory = z.infer<typeof SkillCategory>;

export const ResumeSkill = z.object({
  name: z.string().min(1),
  category: SkillCategory.default('technical'),
  
  years: z.number().min(0).max(60).nullable().default(null),
});
export type ResumeSkill = z.infer<typeof ResumeSkill>;

export const WorkExperience = z.object({
  id: Id,
  title: z.string().default(''),
  company: z.string().default(''),
  location: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  current: z.boolean().default(false),
  responsibilities: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
});
export type WorkExperience = z.infer<typeof WorkExperience>;

export const Education = z.object({
  id: Id,
  degree: z.string().default(''),
  field: z.string().default(''),
  institution: z.string().default(''),
  location: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  gpa: z.string().default(''),
  highlights: z.array(z.string()).default([]),
});
export type Education = z.infer<typeof Education>;

export const Certification = z.object({
  id: Id,
  name: z.string().default(''),
  issuer: z.string().default(''),
  issued: z.string().default(''),
  expires: z.string().default(''),
  credentialId: z.string().default(''),
});
export type Certification = z.infer<typeof Certification>;

export const Project = z.object({
  id: Id,
  name: z.string().default(''),
  description: z.string().default(''),
  url: z.string().default(''),
  technologies: z.array(z.string()).default([]),
  highlights: z.array(z.string()).default([]),
});
export type Project = z.infer<typeof Project>;

export const ContactInfo = z.object({
  name: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  location: z.string().default(''),
  linkedin: z.string().default(''),
  github: z.string().default(''),
  portfolio: z.string().default(''),
});
export type ContactInfo = z.infer<typeof ContactInfo>;

export const ResumeProfile = z.object({
  contact: ContactInfo.prefault({}),
  summary: z.string().default(''),
  skills: z.array(ResumeSkill).default([]),
  experience: z.array(WorkExperience).default([]),
  education: z.array(Education).default([]),
  certifications: z.array(Certification).default([]),
  projects: z.array(Project).default([]),
  languages: z.array(z.string()).default([]),
});
export type ResumeProfile = z.infer<typeof ResumeProfile>;

export const ResumeFileType = z.enum(['pdf', 'docx', 'txt']);
export type ResumeFileType = z.infer<typeof ResumeFileType>;

export const ResumeOrigin = z.object({
  fileName: z.string().default(''),
  fileType: ResumeFileType.default('txt'),
  fileSize: z.number().default(0),
  uploadedAt: IsoDate,
  
  rawText: z.string().default(''),
});
export type ResumeOrigin = z.infer<typeof ResumeOrigin>;

export const Resume = Timestamped.extend({
  id: Id,
  label: z.string().default('My Resume'),
  origin: ResumeOrigin,
  
  parsed: ResumeProfile,
  
  profile: ResumeProfile,
  
  needsReview: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});
export type Resume = z.infer<typeof Resume>;

export const ResumeVersionKind = z.enum(['base', 'tailored', 'manual']);
export type ResumeVersionKind = z.infer<typeof ResumeVersionKind>;

export const ResumeVersion = Timestamped.extend({
  id: Id,
  resumeId: Id,
  name: z.string().min(1),
  kind: ResumeVersionKind.default('manual'),
  
  jobId: Id.nullable().default(null),
  profile: ResumeProfile,
  
  content: z.string().default(''),
  notes: z.string().default(''),
});
export type ResumeVersion = z.infer<typeof ResumeVersion>;
