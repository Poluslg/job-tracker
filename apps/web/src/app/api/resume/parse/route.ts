import { ParseResumeRequest, nowIso } from "@job-ai/types";
import {
  AIResumeParse,
  createProvider,
  isConfigured,
  resumeParsePrompt,
  runPrompt,
} from "@job-ai/ai";
import {
  createId,
  parseResumeText,
  hasUsefulProfile,
  normalizeProfile,
} from "@job-ai/core";
import { loadUserData, mutateUserData } from "@/server/data";
import { ok, readJson, route } from "@/server/http";

export async function POST(request: Request) {
  return route(async () => {
    const parsed = await readJson(request, ParseResumeRequest);

    if (!parsed.ok) {
      return parsed.response;
    }

    const body = parsed.data;

    const { data } = await loadUserData();
    const settings = data.settings;

    const aiConfig = settings.demoMode
      ? {
          ...settings.ai,
          provider: "mock" as const,
        }
      : settings.ai;

    const aiConfigured = settings.demoMode || isConfigured(aiConfig);

    const aiEnabled = body.useAI && aiConfigured;

    const fallbackProfile = parseResumeText(body.text);

    let finalProfile = fallbackProfile;
    let usedAI = false;

    if (aiEnabled) {
      try {
        const provider = createProvider(aiConfig);

        const result = await runPrompt(
          provider,
          resumeParsePrompt,
          AIResumeParse,
          {
            resumeText: body.text.slice(0, 80_000),
            draftSummary: "",
          },
        );

        const aiProfile = normalizeProfile(result.data);

        if (hasUsefulProfile(aiProfile)) {
          finalProfile = aiProfile;
          usedAI = true;
        } else {
          console.error("[Resume AI] AI returned insufficient data");
        }
      } catch (error) {
        console.error("[Resume AI Parse Error]", error);

        if (error instanceof Error) {
          console.error("[Resume AI Error Message]", error.message);

          console.error("[Resume AI Error Stack]", error.stack);
        }
      }
    }

    const now = nowIso();

    const resume = {
      id: createId("res"),
      label: body.fileName.replace(/\.[^.]+$/, "") || "My Resume",
      origin: {
        fileName: body.fileName,
        fileType: body.fileType,
        fileSize: body.text.length,
        uploadedAt: now,
        rawText: body.text,
      },
      parsed: finalProfile,
      profile: finalProfile,
      needsReview: !usedAI,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    };

    await mutateUserData((d) => {
      d.resumes = [resume];
      d.resumeVersions = [];
    });

    return ok(
      {
        resume,
        usedAI,
      },
      201,
    );
  });
}
