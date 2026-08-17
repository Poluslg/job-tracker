import { z } from "zod";
import { ResumeVersion } from "@job-ai/types";
import { loadUserData, mutateUserData } from "@/server/data";
import { fail, ok, readJson, route } from "@/server/http";

export async function GET() {
  return route(async () => {
    const { data } = await loadUserData();
    return ok({ versions: data.resumeVersions, resumes: data.resumes });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const parsed = await readJson(request, ResumeVersion);
    if (!parsed.ok) return parsed.response;
    await mutateUserData((data) => {
      const index = data.resumeVersions.findIndex(
        (v) => v.id === parsed.data.id,
      );
      if (index >= 0) data.resumeVersions[index] = parsed.data;
      else data.resumeVersions.push(parsed.data);
    });
    return ok({ version: parsed.data }, 201);
  });
}

export async function DELETE(request: Request) {
  return route(async () => {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return fail("validation", "A version id is required.", 422);

    await mutateUserData((data) => {
      data.resumeVersions = data.resumeVersions.filter((v) => v.id !== id);

      for (const app of data.applications) {
        if (app.resumeVersionId === id) {
          app.resumeVersionId = null;
          app.resumeVersionName = "";
        }
      }
    });

    return ok({ deleted: true });
  });
}
