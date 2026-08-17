import { InterviewPrepRequest } from '@job-ai/types';
import { CareerAI, createProvider, isConfigured } from '@job-ai/ai';
import { loadUserData, mutateUserData } from '@/server/data';
import { clientKey, fail, ok, rateLimit, readJson, route, tooManyRequests } from '@/server/http';

export async function GET() {
  return route(async () => {
    const { data } = await loadUserData();
    return ok({
      preps: [...data.interviewPreps].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      jobs: data.jobs,
    });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const limit = rateLimit(clientKey(request, 'interview-prep'), 15, 60_000);
    if (!limit.allowed) return tooManyRequests(limit.retryAfter);

    const parsed = await readJson(request, InterviewPrepRequest);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const { data } = await loadUserData();
    const job = data.jobs.find((j) => j.id === body.jobId);
    const resume = data.resumes.find((r) => r.id === body.resumeId);
    if (!job || !resume) return fail('not-found', 'That job or resume does not exist.', 404);

    const settings = data.settings;
    const aiConfig = settings.demoMode ? { ...settings.ai, provider: 'mock' as const } : settings.ai;
    if (!settings.demoMode && !isConfigured(aiConfig)) {
      return fail('no-key', 'Add an AI provider key in Settings to build interview prep.', 400);
    }

    const analysis = data.analyses.find((a) => a.jobId === job.id) ?? null;
    const ai = new CareerAI({ provider: createProvider(aiConfig), settings });
    const prep = await ai.generateInterviewPrep(resume, job, analysis, {
      applicationId: body.applicationId,
    });

    await mutateUserData((d) => {
      d.interviewPreps.push(prep);
      const application = d.applications.find((a) => a.jobId === job.id);
      if (application) application.interviewPrepId = prep.id;
    });

    return ok({ prep }, 201);
  });
}
