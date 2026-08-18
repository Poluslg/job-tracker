import type {
  Application,
  ExtMessage,
  ExtensionState,
  JobPosting,
  Resume,
  UserSettings,
} from "@job-ai/types";
import { AIError, JobPosting as JobPostingSchema, nowIso } from "@job-ai/types";
import {
  applicationFromJob,
  createId,
  exportTracker,
  extractRequirements,
  fingerprintFor,
  hasUsefulProfile,
  normalizeProfile,
  parseResumeText,
  profileToPlainText,
  toDataUrl,
} from "@job-ai/core";
import {
  AIResumeParse,
  CareerAI,
  applyTailorChanges,
  createProvider,
  isConfigured,
  resumeParsePrompt,
  runPrompt,
} from "@job-ai/ai";
import { getDetected, store } from "./index.ts";

export async function handleMessage(
  message: ExtMessage,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  switch (message.type) {
    case "GET_STATE":
      return getState();

    case "GET_SETTINGS":
      return store.getSettings();

    case "UPDATE_SETTINGS":
      return store.updateSettings(message.payload);

    case "GET_ACTIVE_JOB":
      return getActiveJob(message.payload.tabId ?? sender.tab?.id);

    case "ANALYZE_JOB":
      return analyzeJob(message.payload.job, message.payload.useAI);

    case "SAVE_JOB":
      return saveJob(
        message.payload.job,
        message.payload.track,
        message.payload.analysisId,
      );

    case "SAVE_RESUME":
      return saveResume(message.payload);

    case "GET_RESUME":
      return { resume: await store.getDefaultResume() };

    case "UPDATE_RESUME_PROFILE": {
      const { id, profile } = message.payload;
      const resume = await store.getResume(id);
      if (!resume) throw new Error("That resume no longer exists.");
      return {
        resume: await store.saveResume({
          ...resume,
          profile,
          needsReview: false,
        }),
      };
    }

    case "TAILOR_RESUME":
      return tailorResume(message.payload);

    case "GENERATE_COVER_LETTER":
      return generateCoverLetter(message.payload);

    case "GENERATE_INTERVIEW_PREP":
      return generateInterviewPrep(message.payload);

    case "LIST_APPLICATIONS":
      return { applications: await store.getApplications() };

    case "UPDATE_APPLICATION": {
      const application = await store.updateApplication(
        message.payload.id,
        message.payload.patch,
      );
      if (!application) throw new Error("That application no longer exists.");
      return { application };
    }

    case "EXPORT_TRACKER":
      return exportTrackerFile(message.payload.format);

    case "TEST_AI_CONNECTION":
      return testConnection(message.payload);

    case "GET_AVAILABLE_MODELS":
      return getAvailableModels(message.payload);

    case "CLEAR_LOCAL_DATA":
      await store.clear(message.payload.scope);
      return { ok: true };

    default:
      throw new Error(
        `Unsupported message: ${(message as { type: string }).type}`,
      );
  }
}

async function getState(): Promise<ExtensionState> {
  const [settings, resume, applications] = await Promise.all([
    store.getSettings(),
    store.getDefaultResume(),
    store.getApplications(),
  ]);

  return {
    hasResume: resume !== null,
    resumeLabel: resume?.label ?? "",
    onboarded: settings.onboardingCompletedAt !== null,
    aiConfigured: settings.demoMode || isConfigured(settings.ai),
    provider: settings.ai.provider,
    demoMode: settings.demoMode,
    authMode: settings.authMode,
    applicationCount: applications.length,
  };
}

async function getActiveJob(tabId: number | undefined) {
  const detected = getDetected(tabId);
  if (!detected?.job) return { job: null, analysis: null };

  const job = normalizeJob(detected.job);
  const existing = (await store.getJobs()).find(
    (j) => j.fingerprint === job.fingerprint,
  );
  if (!existing) return { job, analysis: null };

  return {
    job: existing,
    analysis: await store.getLatestAnalysisForJob(existing.id),
  };
}

function normalizeJob(draft: Partial<JobPosting>): JobPosting {
  const now = nowIso();
  const description = draft.description ?? "";
  return JobPostingSchema.parse({
    ...draft,
    id: draft.id ?? createId("job"),
    description,
    requirements: draft.requirements?.length
      ? draft.requirements
      : extractRequirements(description),
    fingerprint:
      draft.fingerprint ||
      fingerprintFor(draft.company ?? "", draft.title ?? "", description),
    capturedAt: draft.capturedAt ?? now,
    createdAt: draft.createdAt ?? now,
    updatedAt: now,
  });
}

async function makeAI(
  settings: UserSettings,
  onProgress?: (stage: string) => void,
) {
  const config = settings.demoMode
    ? { ...settings.ai, provider: "mock" as const }
    : settings.ai;
  if (!settings.demoMode && !isConfigured(config)) return null;
  return new CareerAI({
    provider: createProvider(config),
    settings,
    ...(onProgress ? { onProgress } : {}),
  });
}

async function analyzeJob(draft: Partial<JobPosting>, useAI: boolean) {
  const settings = await store.getSettings();
  const resume = await store.getDefaultResume();
  if (!resume) {
    throw new AIError("unknown", "Upload a resume before analyzing a job.");
  }
  if (!draft.description || draft.description.trim().length < 100) {
    throw new AIError(
      "unknown",
      'No job description was captured. Use "Select it manually" on the page and try again.',
    );
  }

  const job = await store.saveJob(normalizeJob(draft));
  const ai = await makeAI(settings, (stage) => {
    void chrome.runtime
      .sendMessage({ type: "PROGRESS", payload: { stage, label: stage } })
      .catch(() => {});
  });

  if (!ai) {
    const local = new CareerAI({
      provider: createProvider({ ...settings.ai, provider: "mock" }),
      settings,
    });
    const { analysis } = await local.analyzeJob(resume, job, {
      useAI: false,
      weights: settings.scoring,
    });
    return { job, analysis: await store.saveAnalysis(analysis) };
  }

  const { analysis, aiError } = await ai.analyzeJob(resume, job, {
    useAI: useAI && (settings.demoMode || isConfigured(settings.ai)),
    weights: settings.scoring,
  });

  const saved = await store.saveAnalysis(analysis);

  return {
    job,
    analysis: saved,
    aiError: aiError ? { code: aiError.code, message: aiError.message } : null,
  };
}

async function saveJob(
  draft: Partial<JobPosting>,
  track: boolean,
  analysisId?: string,
) {
  const settings = await store.getSettings();
  const job = await store.saveJob(normalizeJob(draft));

  const existing = await store.getApplicationByJob(job.id);
  if (existing) return { job, application: existing };
  if (!track) return { job, application: null };

  const analysis = analysisId
    ? await store.getAnalysis(analysisId)
    : await store.getLatestAnalysisForJob(job.id);

  const version = analysis?.resumeVersionId
    ? await store.getVersion(analysis.resumeVersionId)
    : null;

  const application = await store.saveApplication(
    applicationFromJob(job, {
      status: "saved",
      analysis,
      resumeVersionId: version?.id ?? null,
      resumeVersionName: version?.name ?? "",
      storeSnapshot: settings.privacy.storeJobSnapshots,
    }),
  );

  return { job, application };
}

async function saveResume(payload: {
  fileName: string;
  fileType: "pdf" | "docx" | "txt";
  text: string;
  useAI: boolean;
}): Promise<{ resume: Resume; usedAI: boolean }> {
  if (payload.text.trim().length < 100) {
    throw new Error(
      "We could not read enough text from that file. If it is a scanned PDF, try exporting a text-based version.",
    );
  }

  const settings = await store.getSettings();
  const aiConfig = settings.demoMode
    ? {
        ...settings.ai,
        provider: "mock" as const,
      }
    : settings.ai;

  const aiConfigured = settings.demoMode || isConfigured(aiConfig);
  const aiEnabled = payload.useAI && aiConfigured;

  const fallbackProfile = parseResumeText(payload.text);
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
          resumeText: payload.text.slice(0, 80_000),
        },
        { maxOutputTokens: 6000 }
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
      throw error;
    }
  }

  const now = nowIso();

  const resume: Resume = {
    id: createId("res"),
    label: payload.fileName.replace(/\.[^.]+$/, "") || "My Resume",
    origin: {
      fileName: payload.fileName,
      fileType: payload.fileType,
      fileSize: payload.text.length,
      uploadedAt: now,
      rawText: payload.text,
    },
    parsed: finalProfile,
    profile: finalProfile,
    needsReview: !usedAI,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };

  return { resume: await store.saveResume(resume), usedAI };
}

async function requireAI(): Promise<CareerAI> {
  const settings = await store.getSettings();
  const ai = await makeAI(settings);
  if (!ai) {
    throw new AIError(
      "no-key",
      "This feature needs an AI provider. Add a key in Settings, or turn on demo mode to preview it.",
    );
  }
  return ai;
}

async function loadContext(jobId: string) {
  const [job, resume] = await Promise.all([
    store.getJob(jobId),
    store.getDefaultResume(),
  ]);
  if (!job) throw new Error("That job is no longer saved.");
  if (!resume) throw new Error("Upload a resume first.");
  return { job, resume };
}

async function tailorResume(payload: {
  jobId: string;
  analysisId: string;
  acceptedIds: string[];
  versionName: string;
}) {
  const ai = await requireAI();
  const { job, resume } = await loadContext(payload.jobId);
  const analysis = await store.getAnalysis(payload.analysisId);
  if (!analysis)
    throw new Error("Run an analysis before tailoring your resume.");

  const { version, changes } = await ai.tailorResume(resume, job, analysis, {
    versionName: payload.versionName,
    acceptedRecommendationIds: payload.acceptedIds,
  });

  return { version, changes };
}

async function generateCoverLetter(payload: {
  jobId: string;
  tone: Parameters<CareerAI["generateCoverLetter"]>[2]["tone"];
  extraContext?: string;
}) {
  const ai = await requireAI();
  const { job, resume } = await loadContext(payload.jobId);

  const coverLetter = await ai.generateCoverLetter(resume, job, {
    tone: payload.tone,
    extraContext: payload.extraContext ?? "",
  });

  const saved = await store.saveCoverLetter(coverLetter);
  const application = await store.getApplicationByJob(job.id);
  if (application)
    await store.updateApplication(application.id, { coverLetterId: saved.id });

  return { coverLetter: saved };
}

async function generateInterviewPrep(payload: {
  jobId: string;
  applicationId?: string | null;
}) {
  const ai = await requireAI();
  const { job, resume } = await loadContext(payload.jobId);
  const analysis = await store.getLatestAnalysisForJob(job.id);

  const prep = await ai.generateInterviewPrep(resume, job, analysis, {
    applicationId: payload.applicationId ?? null,
  });

  const saved = await store.saveInterviewPrep(prep);
  const application = payload.applicationId
    ? await store.getApplication(payload.applicationId)
    : await store.getApplicationByJob(job.id);
  if (application)
    await store.updateApplication(application.id, {
      interviewPrepId: saved.id,
    });

  return { prep: saved };
}

async function exportTrackerFile(format: "csv" | "xlsx") {
  const applications: Application[] = await store.getApplications();
  if (applications.length === 0) {
    throw new Error("Your tracker is empty — there is nothing to export yet.");
  }
  const file = exportTracker(applications, format);
  return {
    fileName: file.fileName,
    mimeType: file.mimeType,
    dataUrl: toDataUrl(file),
  };
}

async function testConnection(payload: {
  provider: Parameters<typeof createProvider>[0]["provider"];
  apiKey: string;
  model: string;
  baseUrl?: string;
}) {
  const settings = await store.getSettings();
  const provider = createProvider({
    ...settings.ai,
    provider: payload.provider,
    apiKey: payload.apiKey,
    model: payload.model,
    baseUrl: payload.baseUrl ?? "",
  });

  const result = await provider.testConnection();
  return result.ok
    ? { ok: true, message: `Connected to ${provider.meta.name}.` }
    : { ok: false, message: result.error.message };
}

async function getAvailableModels(payload: {
  provider: Parameters<typeof createProvider>[0]["provider"];
  apiKey: string;
  baseUrl?: string;
}) {
  const settings = await store.getSettings();
  const provider = createProvider({
    ...settings.ai,
    provider: payload.provider,
    apiKey: payload.apiKey,
    baseUrl: payload.baseUrl ?? "",
  });

  if (provider.listModels) {
    const models = await provider.listModels();
    return { models };
  }
  return { models: provider.meta.models };
}

export { applyTailorChanges, profileToPlainText };

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeContact(
  contact: Partial<AIResumeParse["contact"]> | undefined,
) {
  return {
    name: cleanString(contact?.name),
    email: cleanString(contact?.email),
    phone: cleanString(contact?.phone),
    location: cleanString(contact?.location),
    linkedin: cleanString(contact?.linkedin),
    github: cleanString(contact?.github),
    portfolio: cleanString(contact?.portfolio),
  };
}

function normalizeProfile(ai: AIResumeParse) {
  return {
    contact: normalizeContact(ai.contact),
    summary: cleanString(ai.summary),
    skills: cleanStringArray(ai.skills).map((name) => ({
      name,
      category: "technical" as const,
      years: null,
    })),
    experience: Array.isArray(ai.experience)
      ? ai.experience
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: createId("exp"),
            title: cleanString(item.title),
            company: cleanString(item.company),
            location: cleanString(item.location),
            startDate: cleanString(item.startDate),
            endDate: cleanString(item.endDate),
            current: Boolean(item.current),
            responsibilities: cleanStringArray(item.responsibilities),
            achievements: cleanStringArray(item.achievements),
            technologies: cleanStringArray(item.technologies),
          }))
          .filter((item) => item.title || item.company)
      : [],
    education: Array.isArray(ai.education)
      ? ai.education
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: createId("edu"),
            degree: cleanString(item.degree),
            field: cleanString(item.field),
            institution: cleanString(item.institution),
            location: cleanString(item.location),
            startDate: cleanString(item.startDate),
            endDate: cleanString(item.endDate),
            gpa: cleanString(item.gpa),
            highlights: cleanStringArray(item.highlights),
          }))
          .filter((item) => item.degree || item.institution)
      : [],
    certifications: Array.isArray(ai.certifications)
      ? ai.certifications
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: createId("cert"),
            name: cleanString(item.name),
            issuer: cleanString(item.issuer),
            issued: cleanString(item.date),
            expires: "",
            credentialId: cleanString(item.url),
          }))
          .filter((item) => item.name)
      : [],
    projects: Array.isArray(ai.projects)
      ? ai.projects
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: createId("proj"),
            name: cleanString(item.name),
            description: cleanString(item.description),
            url: cleanString(item.url),
            technologies: cleanStringArray(item.technologies),
            highlights: cleanStringArray(item.highlights),
          }))
          .filter((item) => item.name)
      : [],
    languages: cleanStringArray(ai.languages),
  };
}
