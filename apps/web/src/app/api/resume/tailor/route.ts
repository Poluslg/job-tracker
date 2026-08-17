import { TailorResumeRequest } from '@job-ai/types';
import { CareerAI, createProvider, isConfigured } from '@job-ai/ai';
import { loadUserData, mutateUserData } from '@/server/data';
import { clientKey, fail, ok, rateLimit, readJson, route, tooManyRequests } from '@/server/http';

export async function POST(request: Request) {
  return route(async () => {
    const limit = rateLimit(clientKey(request, 'tailor'), 15, 60_000);
    if (!limit.allowed) return tooManyRequests(limit.retryAfter);

    const parsed = await readJson(request, TailorResumeRequest);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const { data } = await loadUserData();
    const job = data.jobs.find((j) => j.id === body.jobId);
    const resume = data.resumes.find((r) => r.id === body.resumeId);
    if (!job || !resume) return fail('not-found', 'That job or resume does not exist.', 404);

    const analysis =
      (body.analysisId ? data.analyses.find((a) => a.id === body.analysisId) : null) ??
      data.analyses.filter((a) => a.jobId === job.id)[0];
    if (!analysis) return fail('no-analysis', 'Analyze this job before tailoring your resume.', 400);

    const settings = data.settings;
    const aiConfig = settings.demoMode ? { ...settings.ai, provider: 'mock' as const } : settings.ai;
    if (!settings.demoMode && !isConfigured(aiConfig)) {
      return fail('no-key', 'Add an AI provider key in Settings to use resume tailoring.', 400);
    }

    const ai = new CareerAI({ provider: createProvider(aiConfig), settings });
    const { version, changes, unverifiable } = await ai.tailorResume(resume, job, analysis, {
      versionName: body.versionName,
      acceptedRecommendationIds: body.acceptedRecommendations,
    });

    await mutateUserData((d) => {
      d.resumeVersions.push(version);
    });

    return ok({ version, changes, unverifiable }, 201);
  });
}
