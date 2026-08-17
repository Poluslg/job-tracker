import { ParseResumeRequest, nowIso } from '@job-ai/types';
import { createId, parseResumeText } from '@job-ai/core';
import { mutateUserData } from '@/server/data';
import { ok, readJson, route } from '@/server/http';

export async function POST(request: Request) {
  return route(async () => {
    const parsed = await readJson(request, ParseResumeRequest);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const now = nowIso();
    const profile = parseResumeText(body.text);
    const resume = {
      id: createId('res'),
      label: body.fileName.replace(/\.[^.]+$/, '') || 'My Resume',
      origin: {
        fileName: body.fileName,
        fileType: body.fileType,
        fileSize: body.text.length,
        uploadedAt: now,
        rawText: body.text,
      },
      parsed: profile,
      profile,
      needsReview: true,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    };

    await mutateUserData((data) => {
      data.resumes = data.resumes.map((r) => ({ ...r, isDefault: false }));
      data.resumes.push(resume);
    });

    return ok({ resume }, 201);
  });
}
