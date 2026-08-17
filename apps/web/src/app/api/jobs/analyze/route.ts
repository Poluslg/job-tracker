import { AnalyzeJobRequest, JobPosting, nowIso } from '@job-ai/types';
import { createId, extractRequirements, fingerprintFor } from '@job-ai/core';
import { CareerAI, createProvider, isConfigured } from '@job-ai/ai';
import { loadUserData, mutateUserData } from '@/server/data';
import { clientKey, fail, ok, rateLimit, readJson, route, tooManyRequests } from '@/server/http';

export async function POST(request: Request) {
  return route(async () => {
    const limit = rateLimit(clientKey(request, 'analyze'), 30, 60_000);
    if (!limit.allowed) return tooManyRequests(limit.retryAfter);

    const parsed = await readJson(request, AnalyzeJobRequest);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const { data } = await loadUserData();
    const resume = body.resumeId
      ? data.resumes.find((r) => r.id === body.resumeId)
      : (data.resumes.find((r) => r.isDefault) ?? data.resumes[0]);

    if (!resume) {
      return fail('no-resume', 'Add a resume before analyzing a job.', 400);
    }
    if (!body.job.description || body.job.description.trim().length < 100) {
      return fail('no-description', 'The job description is missing or too short to analyze.', 422);
    }

    const now = nowIso();
    const job = JobPosting.parse({
      ...body.job,
      id: body.job.id ?? createId('job'),
      requirements: body.job.requirements?.length
        ? body.job.requirements
        : extractRequirements(body.job.description),
      fingerprint:
        body.job.fingerprint ||
        fingerprintFor(body.job.company ?? '', body.job.title ?? '', body.job.description),
      capturedAt: body.job.capturedAt ?? now,
      createdAt: body.job.createdAt ?? now,
      updatedAt: now,
    });

    const settings = data.settings;
    const aiConfig = settings.demoMode ? { ...settings.ai, provider: 'mock' as const } : settings.ai;
    const useAI = body.useAI && (settings.demoMode || isConfigured(aiConfig));

    const ai = new CareerAI({ provider: createProvider(useAI ? aiConfig : { ...aiConfig, provider: 'mock' }), settings });
    const { analysis, aiError } = await ai.analyzeJob(resume, job, {
      useAI,
      weights: settings.scoring,
    });

    await mutateUserData((d) => {
      
      const existing = d.jobs.findIndex((j) => j.fingerprint === job.fingerprint);
      if (existing >= 0) {
        analysis.jobId = d.jobs[existing]!.id;
        d.jobs[existing] = { ...d.jobs[existing]!, ...job, id: d.jobs[existing]!.id };
      } else {
        d.jobs.push(job);
      }
      d.analyses.unshift(analysis);
      d.analyses = d.analyses.slice(0, 300);
    });

    return ok({
      job,
      analysis,
      aiError: aiError ? { code: aiError.code, message: aiError.message } : null,
    });
  });
}
