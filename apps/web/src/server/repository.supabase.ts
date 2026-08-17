import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Application,
  CoverLetter,
  InterviewPrep,
  JobAnalysis,
  JobPosting,
  Resume,
  ResumeVersion,
  UserSettings,
} from '@job-ai/types';
import { DEFAULT_SETTINGS, UserSettings as UserSettingsSchema } from '@job-ai/types';
import type { Repository, UserData } from './repository.ts';
import { emptyUserData } from './repository.ts';
import { getSupabaseAdminClient, getSupabaseServerClient } from './supabase.ts';

export class SupabaseRepository implements Repository {
  private async client(): Promise<SupabaseClient> {
    return getSupabaseServerClient();
  }

  async getUserData(userId: string): Promise<UserData> {
    const db = await this.client();

    const [resumes, versions, jobs, analyses, applications, coverLetters, preps, settings] =
      await Promise.all([
        db.from('resumes').select('data').eq('user_id', userId),
        db.from('resume_versions').select('data').eq('user_id', userId),
        db.from('jobs').select('data').eq('user_id', userId).order('captured_at', { ascending: false }),
        db.from('analyses').select('data').eq('user_id', userId).order('created_at', { ascending: false }).limit(300),
        db.from('applications').select('data').eq('user_id', userId).order('discovered_at', { ascending: false }),
        db.from('cover_letters').select('data').eq('user_id', userId).order('created_at', { ascending: false }),
        db.from('interview_preps').select('data').eq('user_id', userId).order('created_at', { ascending: false }),
        db.from('user_settings').select('data').eq('user_id', userId).maybeSingle(),
      ]);

    const failure = [resumes, versions, jobs, analyses, applications, coverLetters, preps, settings].find(
      (r) => r.error,
    );
    if (failure?.error) {
      throw new Error(`Could not load your workspace: ${failure.error.message}`);
    }

    return {
      resumes: rows<Resume>(resumes.data),
      resumeVersions: rows<ResumeVersion>(versions.data),
      jobs: rows<JobPosting>(jobs.data),
      analyses: rows<JobAnalysis>(analyses.data),
      applications: rows<Application>(applications.data),
      coverLetters: rows<CoverLetter>(coverLetters.data),
      interviewPreps: rows<InterviewPrep>(preps.data),
      settings: await this.loadSettings(userId, settings.data?.['data']),
    };
  }

  private async loadSettings(userId: string, blob: unknown): Promise<UserSettings> {
    const parsed = blob ? UserSettingsSchema.safeParse(blob) : null;
    const settings = parsed?.success ? parsed.data : DEFAULT_SETTINGS;

    let apiKey = '';
    try {
      const admin = getSupabaseAdminClient();
      const { data } = await admin
        .from('ai_credentials')
        .select('api_key')
        .eq('user_id', userId)
        .maybeSingle();
      apiKey = (data?.['api_key'] as string | undefined) ?? '';
    } catch {

    }

    return { ...settings, ai: { ...settings.ai, apiKey } };
  }

  async updateUserData(
    userId: string,
    mutate: (data: UserData) => void | Promise<void>,
  ): Promise<UserData> {
    const before = await this.getUserData(userId);
    const after = structuredClone(before);
    await mutate(after);
    await this.persistDiff(userId, before, after);
    return after;
  }

  private async persistDiff(userId: string, before: UserData, after: UserData): Promise<void> {
    const db = await this.client();

    await Promise.all([
      syncTable(db, userId, 'resumes', before.resumes, after.resumes, (r) => ({
        id: r.id,
        user_id: userId,
        label: r.label,
        is_default: r.isDefault,
        data: r,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      })),

      syncTable(db, userId, 'resume_versions', before.resumeVersions, after.resumeVersions, (v) => ({
        id: v.id,
        user_id: userId,
        resume_id: v.resumeId,
        job_id: v.jobId,
        name: v.name,
        kind: v.kind,
        data: v,
        created_at: v.createdAt,
        updated_at: v.updatedAt,
      })),

      syncTable(db, userId, 'jobs', before.jobs, after.jobs, (j) => ({
        id: j.id,
        user_id: userId,
        fingerprint: j.fingerprint,
        title: j.title,
        company: j.company,
        url: j.url,
        data: j,
        captured_at: j.capturedAt,
        created_at: j.createdAt,
        updated_at: j.updatedAt,
      })),

      syncTable(db, userId, 'analyses', before.analyses, after.analyses, (a) => ({
        id: a.id,
        user_id: userId,
        job_id: a.jobId,
        resume_id: a.resumeId,
        overall_score: Math.round(a.score.overall),
        mode: a.mode,
        data: a,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
      })),

      syncTable(db, userId, 'applications', before.applications, after.applications, (a) => ({
        id: a.id,
        user_id: userId,
        job_id: a.jobId,
        status: a.status,
        company: a.company,
        title: a.title,
        match_score: a.matchScore,
        discovered_at: a.discoveredAt,
        applied_at: a.appliedAt,
        data: a,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
      })),

      syncTable(db, userId, 'cover_letters', before.coverLetters, after.coverLetters, (c) => ({
        id: c.id,
        user_id: userId,
        job_id: c.jobId,
        data: c,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      })),

      syncTable(db, userId, 'interview_preps', before.interviewPreps, after.interviewPreps, (p) => ({
        id: p.id,
        user_id: userId,
        job_id: p.jobId,
        application_id: p.applicationId,
        data: p,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
      })),

      this.persistSettings(userId, before.settings, after.settings),
    ]);
  }

  private async persistSettings(
    userId: string,
    before: UserSettings,
    after: UserSettings,
  ): Promise<void> {
    const db = await this.client();

    const blob: UserSettings = { ...after, ai: { ...after.ai, apiKey: '' } };
    const blobChanged = JSON.stringify(blob) !== JSON.stringify({ ...before, ai: { ...before.ai, apiKey: '' } });

    if (blobChanged) {
      const { error } = await db
        .from('user_settings')
        .upsert({ user_id: userId, data: blob, updated_at: new Date().toISOString() });
      if (error) throw new Error(`Could not save your settings: ${error.message}`);
    }

    if (after.ai.apiKey !== before.ai.apiKey) {
      
      const admin = getSupabaseAdminClient();
      const { error } = await admin.from('ai_credentials').upsert({
        user_id: userId,
        provider: after.ai.provider,
        api_key: after.ai.apiKey,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(`Could not save your API key: ${error.message}`);
    }
  }

  async deleteUserData(userId: string): Promise<void> {

    const admin = getSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Could not delete your account: ${error.message}`);
  }
}

function rows<T>(records: Array<Record<string, unknown>> | null): T[] {
  return (records ?? []).map((r) => r['data'] as T);
}

interface Identified {
  id: string;
}

async function syncTable<T extends Identified>(
  db: SupabaseClient,
  userId: string,
  table: string,
  before: T[],
  after: T[],
  toRow: (item: T) => Record<string, unknown>,
): Promise<void> {
  const beforeById = new Map(before.map((item) => [item.id, JSON.stringify(item)]));
  const afterIds = new Set(after.map((item) => item.id));

  const changed = after.filter((item) => beforeById.get(item.id) !== JSON.stringify(item));
  const removed = before.filter((item) => !afterIds.has(item.id)).map((item) => item.id);

  if (changed.length > 0) {
    const { error } = await db.from(table).upsert(changed.map(toRow));
    if (error) throw new Error(`Could not save ${table}: ${error.message}`);
  }

  if (removed.length > 0) {
    const { error } = await db.from(table).delete().eq('user_id', userId).in('id', removed);
    if (error) throw new Error(`Could not delete from ${table}: ${error.message}`);
  }
}

export { emptyUserData };
