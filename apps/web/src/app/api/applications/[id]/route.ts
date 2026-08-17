import { UpdateApplicationRequest, nowIso } from '@job-ai/types';
import { createId } from '@job-ai/core';
import { loadUserData, mutateUserData } from '@/server/data';
import { fail, ok, readJson, route } from '@/server/http';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  return route(async () => {
    const { id } = await params;
    const { data } = await loadUserData();
    const application = data.applications.find((a) => a.id === id);
    if (!application) return fail('not-found', 'That application does not exist.', 404);

    return ok({
      application,
      job: data.jobs.find((j) => j.id === application.jobId) ?? null,
      analysis: data.analyses.find((a) => a.id === application.analysisId) ?? null,
      coverLetter: data.coverLetters.find((c) => c.id === application.coverLetterId) ?? null,
      interviewPrep: data.interviewPreps.find((p) => p.id === application.interviewPrepId) ?? null,
    });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return route(async () => {
    const { id } = await params;
    const parsed = await readJson(request, UpdateApplicationRequest);
    if (!parsed.ok) return parsed.response;
    
    const patch = parsed.present(parsed.data);

    let updated = null;
    await mutateUserData((data) => {
      const index = data.applications.findIndex((a) => a.id === id);
      if (index === -1) return;
      const existing = data.applications[index]!;

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

      updated = { ...existing, ...patch, id, appliedAt, timeline, updatedAt: nowIso() };
      data.applications[index] = updated;
    });

    if (!updated) return fail('not-found', 'That application does not exist.', 404);
    return ok({ application: updated });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return route(async () => {
    const { id } = await params;
    let removed = false;
    await mutateUserData((data) => {
      const before = data.applications.length;
      data.applications = data.applications.filter((a) => a.id !== id);
      removed = data.applications.length < before;
    });
    if (!removed) return fail('not-found', 'That application does not exist.', 404);
    return ok({ deleted: true });
  });
}
