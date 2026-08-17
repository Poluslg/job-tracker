import type { Application, JobPosting, Resume, ResumeVersion } from '@job-ai/types';
import { nowIso } from '@job-ai/types';
import {
  applicationFromJob,
  computeAnalysis,
  createId,
  createSampleApplications,
  createSampleJob,
  createSampleResume,
  extractRequirements,
  fingerprintFor,
  toAnalysisRecord,
  SAMPLE_JOB_VARIANTS,
} from '@job-ai/core';
import { requireSession } from './auth.ts';
import { getRepository, type UserData as RepoUserData } from './repository.ts';

export type { RepoUserData as UserData };

export async function loadUserData(): Promise<{ userId: string; data: RepoUserData }> {
  const session = await requireSession();
  return { userId: session.userId, data: await getRepository().getUserData(session.userId) };
}

export async function mutateUserData(
  mutate: (data: RepoUserData) => void | Promise<void>,
): Promise<RepoUserData> {
  const session = await requireSession();
  return getRepository().updateUserData(session.userId, mutate);
}

export function seedDemoWorkspace(data: RepoUserData): void {
  const resume: Resume = { ...createSampleResume(), id: createId('res'), isDefault: true, needsReview: false };
  data.resumes = [resume];

  const templates = createSampleApplications();
  const jobs: JobPosting[] = [];
  const applications: Application[] = [];

  const baseJob = createSampleJob();

  const baseVersion: ResumeVersion = {
    id: createId('ver'),
    resumeId: resume.id,
    name: 'General Software Engineer Resume',
    kind: 'base',
    jobId: null,
    profile: resume.profile,
    content: resume.origin.rawText,
    notes: 'The version used for most applications.',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  data.resumeVersions = [
    baseVersion,
    {
      id: createId('ver'),
      resumeId: resume.id,
      name: 'Frontend Developer Resume',
      kind: 'manual',
      jobId: null,
      profile: resume.profile,
      content: resume.origin.rawText,
      notes: 'Leads with the design-system and performance work.',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];

  for (const [index, template] of templates.entries()) {
    const discoveredAt = new Date(Date.now() - template.daysAgo * 24 * 3600 * 1000).toISOString();

    const description = SAMPLE_JOB_VARIANTS[index % SAMPLE_JOB_VARIANTS.length]!;
    const job: JobPosting = {
      ...baseJob,
      id: createId('job'),
      title: template.title,
      company: template.company,
      description,
      requirements: extractRequirements(description),
      url: `https://example.com/careers/${template.company.toLowerCase().replace(/\W+/g, '-')}`,
      fingerprint: fingerprintFor(template.company, template.title, description),
      capturedAt: discoveredAt,
      createdAt: discoveredAt,
      updatedAt: discoveredAt,
    };
    jobs.push(job);

    const analysis = toAnalysisRecord(
      computeAnalysis({ profile: resume.profile, resumeText: resume.origin.rawText, job }),
      job.id,
      resume.id,
    );
    
    analysis.score.overall = template.matchScore;
    analysis.createdAt = discoveredAt;
    data.analyses.push(analysis);

    const application = applicationFromJob(job, { analysis });
    application.discoveredAt = discoveredAt;
    application.createdAt = discoveredAt;
    application.matchScore = template.matchScore;

    const path: Application['status'][] =
      template.status === 'saved'
        ? ['saved']
        : template.status === 'applied'
          ? ['saved', 'applied']
          : template.status === 'rejected'
            ? ['saved', 'applied', 'rejected']
            : template.status === 'interview'
              ? ['saved', 'applied', 'recruiter-screen', 'interview']
              : template.status === 'technical-round'
                ? ['saved', 'applied', 'recruiter-screen', 'interview', 'technical-round']
                : ['saved', 'applied', 'recruiter-screen', 'interview', 'technical-round', 'final-round', 'offer'];

    application.timeline = path.map((status, i) => ({
      id: createId('ev'),
      at: new Date(Date.now() - (template.daysAgo - i * 2) * 24 * 3600 * 1000).toISOString(),
      type: 'status-change' as const,
      from: i === 0 ? null : (path[i - 1] ?? null),
      to: status,
      text: '',
    }));
    application.status = template.status;
    const appliedEvent = application.timeline.find((e) => e.to === 'applied');
    application.appliedAt = appliedEvent?.at ?? null;
    application.resumeVersionId = baseVersion.id;
    application.resumeVersionName = baseVersion.name;

    applications.push(application);
  }

  data.jobs = jobs;
  data.applications = applications;

}
