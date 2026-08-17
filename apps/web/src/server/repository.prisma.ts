import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
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
import { getSupabaseAdminClient } from './supabase.ts';

function createPrismaClient(): PrismaClient {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for Prisma. Set it in apps/web/.env.local.');
  }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export class PrismaRepository implements Repository {
  async getUserData(userId: string): Promise<UserData> {
    const [resumes, versions, jobs, analyses, applications, coverLetters, preps, settings] =
      await Promise.all([
        prisma.resume.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
        prisma.resumeVersion.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
        prisma.job.findMany({ where: { userId }, orderBy: { capturedAt: 'desc' } }),
        prisma.analysis.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 300 }),
        prisma.application.findMany({ where: { userId }, orderBy: { discoveredAt: 'desc' } }),
        prisma.coverLetter.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
        prisma.interviewPrep.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
        prisma.userSettings.findUnique({ where: { userId } }),
      ]);

    return {
      resumes: resumes.map((r) => r.data as unknown as Resume),
      resumeVersions: versions.map((v) => v.data as unknown as ResumeVersion),
      jobs: jobs.map((j) => j.data as unknown as JobPosting),
      analyses: analyses.map((a) => a.data as unknown as JobAnalysis),
      applications: applications.map((a) => a.data as unknown as Application),
      coverLetters: coverLetters.map((c) => c.data as unknown as CoverLetter),
      interviewPreps: preps.map((p) => p.data as unknown as InterviewPrep),
      settings: await this.loadSettings(userId, settings?.data),
    };
  }

  private async loadSettings(userId: string, blob: unknown): Promise<UserSettings> {
    const parsed = blob ? UserSettingsSchema.safeParse(blob) : null;
    const settings = parsed?.success ? parsed.data : DEFAULT_SETTINGS;

    let apiKey = '';
    try {
      const cred = await prisma.aiCredential.findUnique({ where: { userId } });
      apiKey = cred?.apiKey ?? '';
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
    await Promise.all([
      syncTable(
        userId,
        before.resumes,
        after.resumes,
        (r) => ({
          id: r.id,
          userId,
          label: r.label,
          isDefault: r.isDefault,
          data: r as any,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        }),
        prisma.resume,
      ),

      syncTable(
        userId,
        before.resumeVersions,
        after.resumeVersions,
        (v) => ({
          id: v.id,
          userId,
          resumeId: v.resumeId,
          jobId: v.jobId,
          name: v.name,
          kind: v.kind,
          data: v as any,
          createdAt: new Date(v.createdAt),
          updatedAt: new Date(v.updatedAt),
        }),
        prisma.resumeVersion,
      ),

      syncTable(
        userId,
        before.jobs,
        after.jobs,
        (j) => ({
          id: j.id,
          userId,
          fingerprint: j.fingerprint,
          title: j.title,
          company: j.company,
          url: j.url,
          data: j as any,
          capturedAt: new Date(j.capturedAt),
          createdAt: new Date(j.createdAt),
          updatedAt: new Date(j.updatedAt),
        }),
        prisma.job,
      ),

      syncTable(
        userId,
        before.analyses,
        after.analyses,
        (a) => ({
          id: a.id,
          userId,
          jobId: a.jobId,
          resumeId: a.resumeId,
          overallScore: Math.round(a.score.overall),
          mode: a.mode,
          data: a as any,
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
        }),
        prisma.analysis,
      ),

      syncTable(
        userId,
        before.applications,
        after.applications,
        (a) => ({
          id: a.id,
          userId,
          jobId: a.jobId,
          status: a.status,
          company: a.company,
          title: a.title,
          matchScore: a.matchScore ?? null,
          discoveredAt: new Date(a.discoveredAt),
          appliedAt: a.appliedAt ? new Date(a.appliedAt) : null,
          data: a as any,
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
        }),
        prisma.application,
      ),

      syncTable(
        userId,
        before.coverLetters,
        after.coverLetters,
        (c) => ({
          id: c.id,
          userId,
          jobId: c.jobId,
          data: c as any,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        }),
        prisma.coverLetter,
      ),

      syncTable(
        userId,
        before.interviewPreps,
        after.interviewPreps,
        (p) => ({
          id: p.id,
          userId,
          jobId: p.jobId,
          applicationId: p.applicationId ?? null,
          data: p as any,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        }),
        prisma.interviewPrep,
      ),

      this.persistSettings(userId, before.settings, after.settings),
    ]);
  }

  private async persistSettings(
    userId: string,
    before: UserSettings,
    after: UserSettings,
  ): Promise<void> {
    const blob: UserSettings = { ...after, ai: { ...after.ai, apiKey: '' } };
    const blobChanged = JSON.stringify(blob) !== JSON.stringify({ ...before, ai: { ...before.ai, apiKey: '' } });

    if (blobChanged) {
      await prisma.userSettings.upsert({
        where: { userId },
        update: { data: blob as any, updatedAt: new Date() },
        create: { userId, data: blob as any, updatedAt: new Date() },
      });
    }

    if (after.ai.apiKey !== before.ai.apiKey) {
      await prisma.aiCredential.upsert({
        where: { userId },
        update: { provider: after.ai.provider, apiKey: after.ai.apiKey, updatedAt: new Date() },
        create: { userId, provider: after.ai.provider, apiKey: after.ai.apiKey, updatedAt: new Date() },
      });
    }
  }

  async deleteUserData(userId: string): Promise<void> {
    const admin = getSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Could not delete your account: ${error.message}`);
  }
}

interface Identified {
  id: string;
}

async function syncTable<T extends Identified>(
  userId: string,
  before: T[],
  after: T[],
  toRow: (item: T) => any,
  delegate: any,
): Promise<void> {
  const beforeById = new Map(before.map((item) => [item.id, JSON.stringify(item)]));
  const afterIds = new Set(after.map((item) => item.id));

  const changed = after.filter((item) => beforeById.get(item.id) !== JSON.stringify(item));
  const removed = before.filter((item) => !afterIds.has(item.id)).map((item) => item.id);

  if (changed.length > 0) {
    await prisma.$transaction(
      changed.map((item) => {
        const row = toRow(item);
        return delegate.upsert({
          where: { id: row.id },
          update: row,
          create: row,
        });
      })
    );
  }

  if (removed.length > 0) {
    await delegate.deleteMany({
      where: {
        userId,
        id: { in: removed },
      },
    });
  }
}
