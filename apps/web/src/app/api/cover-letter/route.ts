import { CoverLetterRequest } from '@job-ai/types';
import { CareerAI, createProvider, isConfigured } from '@job-ai/ai';
import { loadUserData, mutateUserData } from '@/server/data';
import { clientKey, fail, ok, rateLimit, readJson, route, tooManyRequests } from '@/server/http';

export async function GET() {
  return route(async () => {
    const { data } = await loadUserData();
    return ok({
      coverLetters: [...data.coverLetters].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const limit = rateLimit(clientKey(request, 'cover-letter'), 20, 60_000);
    if (!limit.allowed) return tooManyRequests(limit.retryAfter);

    const parsed = await readJson(request, CoverLetterRequest);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const { data } = await loadUserData();
    const job = data.jobs.find((j) => j.id === body.jobId);
    const resume = data.resumes.find((r) => r.id === body.resumeId);
    if (!job || !resume) return fail('not-found', 'That job or resume does not exist.', 404);

    const settings = data.settings;
    const aiConfig = settings.demoMode ? { ...settings.ai, provider: 'mock' as const } : settings.ai;
    if (!settings.demoMode && !isConfigured(aiConfig)) {
      return fail('no-key', 'Add an AI provider key in Settings to generate cover letters.', 400);
    }

    const ai = new CareerAI({ provider: createProvider(aiConfig), settings });
    const coverLetter = await ai.generateCoverLetter(resume, job, {
      tone: body.tone,
      extraContext: body.extraContext,
      resumeVersionId: body.resumeVersionId,
    });

    await mutateUserData((d) => {
      d.coverLetters.push(coverLetter);
      const application = d.applications.find((a) => a.jobId === job.id);
      if (application) application.coverLetterId = coverLetter.id;
    });

    return ok({ coverLetter }, 201);
  });
}
