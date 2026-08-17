import { z } from 'zod';
import { ResumeProfile, nowIso } from '@job-ai/types';
import { loadUserData, mutateUserData } from '@/server/data';
import { fail, ok, readJson, route } from '@/server/http';

export async function GET() {
  return route(async () => {
    const { data } = await loadUserData();
    return ok({ resumes: data.resumes });
  });
}

const PatchBody = z.object({
  id: z.string().min(1),
  label: z.string().max(120).optional(),
  profile: ResumeProfile.optional(),
  needsReview: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  return route(async () => {
    const parsed = await readJson(request, PatchBody);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    let updated = null;
    await mutateUserData((data) => {
      const index = data.resumes.findIndex((r) => r.id === body.id);
      if (index === -1) return;
      if (body.isDefault) data.resumes = data.resumes.map((r) => ({ ...r, isDefault: false }));

      updated = {
        ...data.resumes[index]!,
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.profile !== undefined ? { profile: body.profile } : {}),
        ...(body.needsReview !== undefined ? { needsReview: body.needsReview } : {}),
        ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        updatedAt: nowIso(),
      };
      data.resumes[index] = updated;
    });

    if (!updated) return fail('not-found', 'That resume does not exist.', 404);
    return ok({ resume: updated });
  });
}

export async function DELETE(request: Request) {
  return route(async () => {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return fail('validation', 'A resume id is required.', 422);

    await mutateUserData((data) => {
      data.resumes = data.resumes.filter((r) => r.id !== id);
      data.resumeVersions = data.resumeVersions.filter((v) => v.resumeId !== id);
      
      if (data.resumes.length && !data.resumes.some((r) => r.isDefault)) {
        data.resumes[0] = { ...data.resumes[0]!, isDefault: true };
      }
    });

    return ok({ deleted: true });
  });
}
