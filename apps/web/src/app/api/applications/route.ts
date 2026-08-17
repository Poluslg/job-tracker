import { CreateApplicationRequest } from '@job-ai/types';
import { applicationFromJob } from '@job-ai/core';
import { loadUserData, mutateUserData } from '@/server/data';
import { fail, ok, readJson, route } from '@/server/http';

export async function GET() {
  return route(async () => {
    const { data } = await loadUserData();
    return ok({
      applications: [...data.applications].sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt)),
    });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const parsed = await readJson(request, CreateApplicationRequest);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const { data } = await loadUserData();
    const job = data.jobs.find((j) => j.id === body.jobId);
    if (!job) return fail('not-found', 'That job is not saved to your account.', 404);

    const existing = data.applications.find((a) => a.jobId === job.id);
    if (existing) return ok({ application: existing });

    const analysis = body.analysisId
      ? (data.analyses.find((a) => a.id === body.analysisId) ?? null)
      : (data.analyses.filter((a) => a.jobId === job.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ??
        null);
    const version = body.resumeVersionId
      ? (data.resumeVersions.find((v) => v.id === body.resumeVersionId) ?? null)
      : null;

    const application = applicationFromJob(job, {
      ...(body.status ? { status: body.status } : {}),
      analysis,
      resumeVersionId: version?.id ?? null,
      resumeVersionName: version?.name ?? '',
      notes: body.notes,
      storeSnapshot: data.settings.privacy.storeJobSnapshots,
    });

    await mutateUserData((d) => {
      d.applications.push(application);
    });

    return ok({ application }, 201);
  });
}
