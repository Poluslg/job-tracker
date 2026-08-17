import type {
  Application,
  ApplicationStatus,
  CoverLetter,
  InterviewPrep,
  JobAnalysis,
  JobPosting,
  Resume,
  ResumeVersion,
  UserSettings,
} from '@job-ai/types';
import { DEFAULT_SETTINGS, UserSettings as UserSettingsSchema, nowIso } from '@job-ai/types';
import type { KeyValueAdapter } from './kv.ts';
import { createId } from '../util/id.ts';

const KEYS = {
  settings: 'settings',
  resumes: 'resumes',
  versions: 'resume-versions',
  jobs: 'jobs',
  analyses: 'analyses',
  applications: 'applications',
  coverLetters: 'cover-letters',
  interviewPreps: 'interview-preps',
  schemaVersion: 'schema-version',
} as const;

export const SCHEMA_VERSION = 1;

export class DataStore {
  private readonly kv: KeyValueAdapter;

  constructor(kv: KeyValueAdapter) {
    this.kv = kv;
  }

  private async list<T>(key: string): Promise<T[]> {
    return (await this.kv.get<T[]>(key)) ?? [];
  }

  private async put<T>(key: string, items: T[]): Promise<void> {
    await this.kv.set(key, items);
  }

  async init(): Promise<void> {
    const version = await this.kv.get<number>(KEYS.schemaVersion);
    if (version === null) await this.kv.set(KEYS.schemaVersion, SCHEMA_VERSION);
    
  }

  async getSettings(): Promise<UserSettings> {
    const raw = await this.kv.get<unknown>(KEYS.settings);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = UserSettingsSchema.safeParse(raw);
    
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  }

  async updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.getSettings();
    const next = UserSettingsSchema.parse({
      ...current,
      ...patch,
      ai: { ...current.ai, ...(patch.ai ?? {}) },
      privacy: { ...current.privacy, ...(patch.privacy ?? {}) },
      ui: { ...current.ui, ...(patch.ui ?? {}) },
      scoring: { ...current.scoring, ...(patch.scoring ?? {}) },
    });
    await this.kv.set(KEYS.settings, next);
    return next;
  }

  async getResumes(): Promise<Resume[]> {
    return this.list<Resume>(KEYS.resumes);
  }

  async getDefaultResume(): Promise<Resume | null> {
    const all = await this.getResumes();
    return all.find((r) => r.isDefault) ?? all[0] ?? null;
  }

  async getResume(id: string): Promise<Resume | null> {
    return (await this.getResumes()).find((r) => r.id === id) ?? null;
  }

  async saveResume(resume: Resume): Promise<Resume> {
    const all = await this.getResumes();
    const idx = all.findIndex((r) => r.id === resume.id);
    const next = { ...resume, updatedAt: nowIso() };
    if (idx >= 0) all[idx] = next;
    else all.push({ ...next, isDefault: all.length === 0 ? true : next.isDefault });
    await this.put(KEYS.resumes, all);
    return next;
  }

  async setDefaultResume(id: string): Promise<void> {
    const all = await this.getResumes();
    await this.put(
      KEYS.resumes,
      all.map((r) => ({ ...r, isDefault: r.id === id })),
    );
  }

  async deleteResume(id: string): Promise<void> {
    await this.put(KEYS.resumes, (await this.getResumes()).filter((r) => r.id !== id));
    await this.put(KEYS.versions, (await this.getVersions()).filter((v) => v.resumeId !== id));
  }

  async getVersions(resumeId?: string): Promise<ResumeVersion[]> {
    const all = await this.list<ResumeVersion>(KEYS.versions);
    return resumeId ? all.filter((v) => v.resumeId === resumeId) : all;
  }

  async getVersion(id: string): Promise<ResumeVersion | null> {
    return (await this.getVersions()).find((v) => v.id === id) ?? null;
  }

  async saveVersion(version: ResumeVersion): Promise<ResumeVersion> {
    const all = await this.getVersions();
    const idx = all.findIndex((v) => v.id === version.id);
    const next = { ...version, updatedAt: nowIso() };
    if (idx >= 0) all[idx] = next;
    else all.push(next);
    await this.put(KEYS.versions, all);
    return next;
  }

  async deleteVersion(id: string): Promise<void> {
    await this.put(KEYS.versions, (await this.getVersions()).filter((v) => v.id !== id));
  }

  async getJobs(): Promise<JobPosting[]> {
    return this.list<JobPosting>(KEYS.jobs);
  }

  async getJob(id: string): Promise<JobPosting | null> {
    return (await this.getJobs()).find((j) => j.id === id) ?? null;
  }

  async saveJob(job: JobPosting): Promise<JobPosting> {
    const all = await this.getJobs();
    const existingIdx = all.findIndex(
      (j) => j.id === job.id || (job.fingerprint !== '' && j.fingerprint === job.fingerprint),
    );
    if (existingIdx >= 0) {
      const merged = { ...all[existingIdx]!, ...job, id: all[existingIdx]!.id, updatedAt: nowIso() };
      all[existingIdx] = merged;
      await this.put(KEYS.jobs, all);
      return merged;
    }
    const created = { ...job, updatedAt: nowIso() };
    all.push(created);
    await this.put(KEYS.jobs, all);
    return created;
  }

  async deleteJob(id: string): Promise<void> {
    await this.put(KEYS.jobs, (await this.getJobs()).filter((j) => j.id !== id));
  }

  async getAnalyses(jobId?: string): Promise<JobAnalysis[]> {
    const all = await this.list<JobAnalysis>(KEYS.analyses);
    return jobId ? all.filter((a) => a.jobId === jobId) : all;
  }

  async getAnalysis(id: string): Promise<JobAnalysis | null> {
    return (await this.getAnalyses()).find((a) => a.id === id) ?? null;
  }

  async getLatestAnalysisForJob(jobId: string): Promise<JobAnalysis | null> {
    const list = (await this.getAnalyses(jobId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list[0] ?? null;
  }

  async saveAnalysis(analysis: JobAnalysis): Promise<JobAnalysis> {
    const all = await this.getAnalyses();
    const idx = all.findIndex((a) => a.id === analysis.id);
    const next = { ...analysis, updatedAt: nowIso() };
    if (idx >= 0) all[idx] = next;
    else all.push(next);
    
    const trimmed = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300);
    await this.put(KEYS.analyses, trimmed);
    return next;
  }

  async getApplications(): Promise<Application[]> {
    const all = await this.list<Application>(KEYS.applications);
    return all.sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt));
  }

  async getApplication(id: string): Promise<Application | null> {
    return (await this.getApplications()).find((a) => a.id === id) ?? null;
  }

  async getApplicationByJob(jobId: string): Promise<Application | null> {
    return (await this.getApplications()).find((a) => a.jobId === jobId) ?? null;
  }

  async saveApplication(app: Application): Promise<Application> {
    const all = await this.getApplications();
    const idx = all.findIndex((a) => a.id === app.id);
    const next = { ...app, updatedAt: nowIso() };
    if (idx >= 0) all[idx] = next;
    else all.push(next);
    await this.put(KEYS.applications, all);
    return next;
  }

  async updateApplication(id: string, patch: Partial<Application>): Promise<Application | null> {
    const existing = await this.getApplication(id);
    if (!existing) return null;

    const statusChanged = patch.status !== undefined && patch.status !== existing.status;
    const timeline = [...existing.timeline];
    if (statusChanged) {
      timeline.push({
        id: createId('ev'),
        at: nowIso(),
        type: 'status-change',
        from: existing.status,
        to: patch.status!,
        text: '',
      });
    }

    const appliedAt =
      patch.appliedAt !== undefined
        ? patch.appliedAt
        : statusChanged && patch.status === 'applied' && !existing.appliedAt
          ? nowIso()
          : existing.appliedAt;

    return this.saveApplication({ ...existing, ...patch, appliedAt, timeline, id });
  }

  async deleteApplication(id: string): Promise<void> {
    await this.put(KEYS.applications, (await this.getApplications()).filter((a) => a.id !== id));
  }

  async getCoverLetters(jobId?: string): Promise<CoverLetter[]> {
    const all = await this.list<CoverLetter>(KEYS.coverLetters);
    return jobId ? all.filter((c) => c.jobId === jobId) : all;
  }

  async getCoverLetter(id: string): Promise<CoverLetter | null> {
    return (await this.getCoverLetters()).find((c) => c.id === id) ?? null;
  }

  async saveCoverLetter(letter: CoverLetter): Promise<CoverLetter> {
    const all = await this.getCoverLetters();
    const idx = all.findIndex((c) => c.id === letter.id);
    const next = { ...letter, updatedAt: nowIso() };
    if (idx >= 0) all[idx] = next;
    else all.push(next);
    await this.put(KEYS.coverLetters, all);
    return next;
  }

  async deleteCoverLetter(id: string): Promise<void> {
    await this.put(KEYS.coverLetters, (await this.getCoverLetters()).filter((c) => c.id !== id));
  }

  async getInterviewPreps(jobId?: string): Promise<InterviewPrep[]> {
    const all = await this.list<InterviewPrep>(KEYS.interviewPreps);
    return jobId ? all.filter((p) => p.jobId === jobId) : all;
  }

  async getInterviewPrep(id: string): Promise<InterviewPrep | null> {
    return (await this.getInterviewPreps()).find((p) => p.id === id) ?? null;
  }

  async saveInterviewPrep(prep: InterviewPrep): Promise<InterviewPrep> {
    const all = await this.getInterviewPreps();
    const idx = all.findIndex((p) => p.id === prep.id);
    const next = { ...prep, updatedAt: nowIso() };
    if (idx >= 0) all[idx] = next;
    else all.push(next);
    await this.put(KEYS.interviewPreps, all);
    return next;
  }

  async clear(scope: 'all' | 'applications' | 'resumes' | 'ai-key'): Promise<void> {
    switch (scope) {
      case 'all': {
        for (const key of await this.kv.keys()) await this.kv.remove(key);
        await this.init();
        return;
      }
      case 'applications': {
        await this.put(KEYS.applications, []);
        await this.put(KEYS.jobs, []);
        await this.put(KEYS.analyses, []);
        await this.put(KEYS.coverLetters, []);
        await this.put(KEYS.interviewPreps, []);
        return;
      }
      case 'resumes': {
        await this.put(KEYS.resumes, []);
        await this.put(KEYS.versions, []);
        return;
      }
      case 'ai-key': {
        const settings = await this.getSettings();
        await this.updateSettings({ ai: { ...settings.ai, apiKey: '' } });
        return;
      }
    }
  }

  async exportAll(): Promise<Record<string, unknown>> {
    const settings = await this.getSettings();
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      
      settings: { ...settings, ai: { ...settings.ai, apiKey: '' } },
      resumes: await this.getResumes(),
      resumeVersions: await this.getVersions(),
      jobs: await this.getJobs(),
      analyses: await this.getAnalyses(),
      applications: await this.getApplications(),
      coverLetters: await this.getCoverLetters(),
      interviewPreps: await this.getInterviewPreps(),
    };
  }
}

export function applicationFromJob(
  job: JobPosting,
  opts: {
    status?: ApplicationStatus;
    analysis?: JobAnalysis | null;
    resumeVersionId?: string | null;
    resumeVersionName?: string;
    notes?: string;
    storeSnapshot?: boolean;
  } = {},
): Application {
  const now = nowIso();
  const status = opts.status ?? 'saved';
  return {
    id: createId('app'),
    jobId: job.id,
    status,
    company: job.company,
    title: job.title,
    url: job.url,
    location: job.location,
    salary: job.salary.raw || formatSalary(job.salary),
    jobType: job.employmentType,
    matchScore: opts.analysis?.score.overall ?? null,
    analysisId: opts.analysis?.id ?? null,
    resumeVersionId: opts.resumeVersionId ?? null,
    resumeVersionName: opts.resumeVersionName ?? '',
    coverLetterId: null,
    interviewPrepId: null,
    discoveredAt: now,
    appliedAt: status === 'applied' ? now : null,
    nextInterviewAt: null,
    followUpAt: null,
    recruiter: { name: '', role: '', email: '', phone: '', linkedin: '' },
    notes: opts.notes ?? '',
    jobDescriptionSnapshot: opts.storeSnapshot === false ? '' : job.description,
    timeline: [{ id: createId('ev'), at: now, type: 'status-change', from: null, to: status, text: '' }],
    createdAt: now,
    updatedAt: now,
  };
}

export function formatSalary(salary: JobPosting['salary']): string {
  if (salary.raw) return salary.raw;
  if (salary.min === null && salary.max === null) return '';
  const fmt = (n: number) => `${salary.currency}${n.toLocaleString()}`;
  const range = salary.min !== null && salary.max !== null
    ? `${fmt(salary.min)} - ${fmt(salary.max)}`
    : fmt((salary.min ?? salary.max)!);
  return salary.period !== 'unknown' ? `${range} / ${salary.period}` : range;
}
