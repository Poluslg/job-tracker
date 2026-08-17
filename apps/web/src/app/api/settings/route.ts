import { UserSettings } from "@job-ai/types";
import { loadUserData, mutateUserData } from "@/server/data";
import { ok, readJson, route } from "@/server/http";

function redact(settings: UserSettings): UserSettings & { hasApiKey: boolean } {
  return {
    ...settings,
    ai: { ...settings.ai, apiKey: "" },
    hasApiKey: settings.ai.apiKey.length > 0,
  };
}

export async function GET() {
  return route(async () => {
    const { data } = await loadUserData();
    return ok({ settings: redact(data.settings) });
  });
}

export async function PATCH(request: Request) {
  return route(async () => {
    const parsed = await readJson(request, UserSettings.partial());
    if (!parsed.ok) return parsed.response;

    const patch = parsed.present(parsed.data);

    let next = null;
    await mutateUserData((data) => {
      next = UserSettings.parse({
        ...data.settings,
        ...patch,

        ai: {
          ...data.settings.ai,
          ...(patch.ai ?? {}),
          apiKey: patch.ai?.apiKey || data.settings.ai.apiKey,
        },
        privacy: { ...data.settings.privacy, ...(patch.privacy ?? {}) },
        ui: { ...data.settings.ui, ...(patch.ui ?? {}) },
        scoring: { ...data.settings.scoring, ...(patch.scoring ?? {}) },
      });
      data.settings = next;
    });

    return ok({ settings: redact(next!) });
  });
}

export async function DELETE() {
  return route(async () => {
    let next = null;
    await mutateUserData((data) => {
      data.settings = {
        ...data.settings,
        ai: { ...data.settings.ai, apiKey: "" },
      };
      next = data.settings;
    });
    return ok({ settings: redact(next!) });
  });
}
