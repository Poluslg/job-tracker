import { SaveJobRequest, JobPosting, nowIso } from '@job-ai/types';
import { applicationFromJob, createId, extractRequirements, fingerprintFor } from '@job-ai/core';
import { loadUserData, mutateUserData } from '@/server/data';
import { ok, readJson, route } from '@/server/http';

export async function GET() {
  return route(async () => {
    const { data } = await loadUserData();
    const trackedJobIds = new Set(data.applications.map((a) => a.jobId));
    return ok({
      jobs: [...data.jobs].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)),
      trackedJobIds: [...trackedJobIds],
    });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const parsed = await readJson(request, SaveJobRequest);
    if (!parsed.ok) return parsed.response;
    const { job: draft, track } = parsed.data;

    const now = nowIso();
    const job = JobPosting.parse({
      ...draft,
      id: draft.id ?? createId('job'),
      requirements: draft.requirements?.length
        ? draft.requirements
        : extractRequirements(draft.description ?? ''),
      fingerprint:
        draft.fingerprint || fingerprintFor(draft.company ?? '', draft.title ?? '', draft.description ?? ''),
      capturedAt: draft.capturedAt ?? now,
      createdAt: draft.createdAt ?? now,
      updatedAt: now,
    });

    let application = null;
    await mutateUserData((data) => {
      const index = data.jobs.findIndex((j) => j.fingerprint === job.fingerprint);
      const saved = index >= 0 ? { ...data.jobs[index]!, ...job, id: data.jobs[index]!.id } : job;
      if (index >= 0) data.jobs[index] = saved;
      else data.jobs.push(saved);

      const existing = data.applications.find((a) => a.jobId === saved.id);
      if (existing) {
        application = existing;
      } else if (track) {
        application = applicationFromJob(saved, {
          storeSnapshot: data.settings.privacy.storeJobSnapshots,
        });
        data.applications.push(application);
      }
    });

    return ok({ job, application }, 201);
  });
}
