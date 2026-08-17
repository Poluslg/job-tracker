import type {
  AIProvider,
  CoverLetter,
  CoverLetterTone,
  InterviewPrep,
  JobAnalysis,
  JobPosting,
  Recommendation,
  Resume,
  ResumeProfile,
  ResumeVersion,
  ScoringWeights,
  TailorChange,
  UserSettings,
} from "@job-ai/types";
import { AIError, nowIso } from "@job-ai/types";
import {
  buildResumeSkillIndex,
  computeAnalysis,
  createId,
  extractRequirements,
  profileToPlainText,
  toAnalysisRecord,
} from "@job-ai/core";

import {
  AICoverLetter,
  AIInterviewPrep,
  AIJobExtraction,
  AIMatchInsights,
  AIRequirements,
  AITailorResume,
} from "../schemas/index.ts";
import { coverLetterPrompt } from "../prompts/coverLetter.ts";
import { interviewPrepPrompt } from "../prompts/interviewPrep.ts";
import {
  jobExtractionPrompt,
  requirementsPrompt,
} from "../prompts/jobExtraction.ts";
import { matchInsightsPrompt } from "../prompts/matchInsights.ts";
import { tailorResumePrompt } from "../prompts/tailorResume.ts";
import { redactContact } from "../prompts/shared.ts";
import { runPrompt } from "./runner.ts";

export interface CareerAIOptions {
  provider: AIProvider;
  settings: UserSettings;

  onProgress?: (stage: string) => void;
}

export interface AnalyzeOptions {
  useAI: boolean;
  signal?: AbortSignal;
  weights?: ScoringWeights;
}

export class CareerAI {
  private readonly provider: AIProvider;
  private readonly settings: UserSettings;
  private readonly onProgress: (stage: string) => void;

  constructor(options: CareerAIOptions) {
    this.provider = options.provider;
    this.settings = options.settings;
    this.onProgress = options.onProgress ?? (() => {});
  }

  private prepare(text: string): string {
    return this.settings.privacy.redactContactInfo ? redactContact(text) : text;
  }

  async analyzeJob(
    resume: Resume,
    job: JobPosting,
    options: AnalyzeOptions,
  ): Promise<{ analysis: JobAnalysis; aiError: AIError | null }> {
    this.onProgress("extracting");

    let requirements = job.requirements.length
      ? job.requirements
      : extractRequirements(job.description);
    let aiError: AIError | null = null;

    if (options.useAI) {
      try {
        const refined = await runPrompt(
          this.provider,
          requirementsPrompt,
          AIRequirements,
          {
            jobTitle: job.title,
            description: this.prepare(job.description),
            existing: requirements.map((r) => ({ text: r.text, kind: r.kind })),
          },
          { ...(options.signal ? { signal: options.signal } : {}) },
        );

        if (refined.data.requirements.length >= 3) {
          requirements = refined.data.requirements.map((r) => ({
            id: createId("req"),
            text: r.text,
            kind: r.kind,
            skills: r.skills,
            yearsRequired: r.yearsRequired,
            confidence:
              r.kind === "signal" ? ("low" as const) : ("high" as const),
          }));
        }
      } catch (err) {
        aiError = asAIError(err);
      }
    }

    this.onProgress("reading-resume");
    const resumeText =
      resume.origin.rawText || profileToPlainText(resume.profile);

    this.onProgress("comparing");
    const computed = computeAnalysis({
      profile: resume.profile,
      resumeText,
      job: { ...job, requirements },
      ...(options.weights ? { weights: options.weights } : {}),
    });

    const analysis = toAnalysisRecord(computed, job.id, resume.id);
    analysis.mode = "local";

    if (options.useAI && !aiError) {
      this.onProgress("recommendations");
      try {
        const insights = await runPrompt(
          this.provider,
          matchInsightsPrompt,
          AIMatchInsights,
          {
            jobTitle: job.title,
            company: job.company,
            description: this.prepare(job.description),
            resumeText: this.prepare(resumeText),
            score: analysis.score.overall,
            strongSkills: analysis.skills
              .filter((s) => s.quality === "strong")
              .map((s) => s.skill),
            partialSkills: analysis.skills
              .filter((s) => s.quality === "partial")
              .map((s) => ({ skill: s.skill, rationale: s.rationale })),
            missingRequired: analysis.skills
              .filter((s) => s.quality === "missing" && s.required)
              .map((s) => s.skill),
            experienceNote: analysis.experience.note,
            atsCoverage: analysis.ats.coverage,
          },
          { ...(options.signal ? { signal: options.signal } : {}) },
        );

        analysis.concerns = [
          ...analysis.concerns,
          ...insights.data.concerns.map((c) => ({
            text: c.text,
            severity: c.severity,
            inferred: true,
          })),
          ...insights.data.hiddenSignals.map((s) => ({
            text: `Possible expectation (AI interpretation, not stated in the posting): ${s.text}`,
            severity: "low" as const,
            inferred: true,
          })),
        ];

        analysis.recommendations = [
          ...analysis.recommendations,
          ...insights.data.recommendations.map((r): Recommendation => ({
            id: createId("rec"),
            kind: "improve-bullet",
            title: r.title,
            detail: r.detail,
            priority: r.priority,
            needsUserConfirmation: r.needsUserConfirmation,
          })),
          ...insights.data.terminologyBridges.map((t): Recommendation => ({
            id: createId("rec"),
            kind: "add-terminology",
            title: `Use the posting's wording: "${t.jobTerm}"`,
            detail: `Your resume describes this as "${t.resumeTerm}". ${t.note} Only make this change if it still describes what you actually did.`,
            priority: "medium",
            needsUserConfirmation: true,
          })),
        ];

        analysis.mode = this.provider.id === "mock" ? "mock" : "ai-assisted";
        analysis.modelUsed = insights.usage.model;
        analysis.promptVersion = insights.promptVersion;
      } catch (err) {
        aiError = asAIError(err);
      }
    }

    this.onProgress("done");
    return { analysis, aiError };
  }

  async extractJobFromText(
    url: string,
    pageTitle: string,
    pageText: string,
    signal?: AbortSignal,
  ): Promise<Partial<JobPosting> | null> {
    const result = await runPrompt(
      this.provider,
      jobExtractionPrompt,
      AIJobExtraction,
      { url, pageTitle, pageText: this.prepare(pageText) },
      { ...(signal ? { signal } : {}) },
    );

    if (!result.data.isJobPosting) return null;

    return {
      title: result.data.title,
      company: result.data.company,
      location: result.data.location,
      employmentType: result.data.employmentType,
      arrangement: result.data.arrangement,
      salary: {
        min: null,
        max: null,
        currency: "",
        period: "unknown",
        raw: result.data.salaryText,
      },
      source: "ai",
    };
  }

  async tailorResume(
    resume: Resume,
    job: JobPosting,
    analysis: JobAnalysis,
    opts: {
      versionName: string;
      acceptedRecommendationIds: string[];
      signal?: AbortSignal;
    },
  ): Promise<{
    version: ResumeVersion;
    changes: TailorChange[];
    unverifiable: string[];
  }> {
    const resumeText =
      resume.origin.rawText || profileToPlainText(resume.profile);
    const accepted = analysis.recommendations
      .filter((r) => opts.acceptedRecommendationIds.includes(r.id))
      .map((r) => `${r.title}: ${r.detail}`);

    const result = await runPrompt(
      this.provider,
      tailorResumePrompt,
      AITailorResume,
      {
        jobTitle: job.title,
        company: job.company,
        description: this.prepare(job.description),
        resumeText: this.prepare(resumeText),
        currentSummary: resume.profile.summary,
        strongSkills: analysis.skills
          .filter((s) => s.quality === "strong")
          .map((s) => s.skill),
        partialSkills: analysis.skills
          .filter((s) => s.quality === "partial")
          .map((s) => s.skill),
        acceptedRecommendations: accepted,
      },
      { ...(opts.signal ? { signal: opts.signal } : {}) },
    );

    const changes: TailorChange[] = result.data.changes.map((c) => ({
      id: createId("chg"),
      section: c.section,
      original: c.original,
      suggested: c.suggested,
      reason: c.reason,
      needsUserConfirmation: c.needsUserConfirmation,
    }));

    const now = nowIso();
    const version: ResumeVersion = {
      id: createId("ver"),
      resumeId: resume.id,
      name: opts.versionName,
      kind: "tailored",
      jobId: job.id,
      profile: resume.profile,
      content: profileToPlainText(resume.profile),
      notes: `Tailored for ${job.title} at ${job.company}.`,
      createdAt: now,
      updatedAt: now,
    };

    return { version, changes, unverifiable: result.data.unverifiable };
  }

  async generateCoverLetter(
    resume: Resume,
    job: JobPosting,
    opts: {
      tone: CoverLetterTone;
      extraContext?: string;
      resumeVersionId?: string | null;
      signal?: AbortSignal;
    },
  ): Promise<CoverLetter> {
    const resumeText =
      resume.origin.rawText || profileToPlainText(resume.profile);
    const index = buildResumeSkillIndex(resume.profile, resumeText);
    const jobSkills = extractRequirements(job.description).flatMap(
      (r) => r.skills,
    );
    const strongSkills = [
      ...new Set(jobSkills.filter((s) => index.skills.has(s))),
    ];

    const result = await runPrompt(
      this.provider,
      coverLetterPrompt,
      AICoverLetter,
      {
        jobTitle: job.title,
        company: job.company,
        description: this.prepare(job.description),

        resumeText: this.prepare(resumeText),
        candidateName: resume.profile.contact.name,
        tone: opts.tone,
        strongSkills,
        extraContext: opts.extraContext ?? "",
      },
      { temperature: 0.5, ...(opts.signal ? { signal: opts.signal } : {}) },
    );

    const now = nowIso();
    return {
      id: createId("cl"),
      jobId: job.id,
      resumeVersionId: opts.resumeVersionId ?? null,
      company: job.company,
      title: job.title,
      tone: opts.tone,
      body: result.data.body,
      needsConfirmation: result.data.needsConfirmation,
      edited: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  async generateInterviewPrep(
    resume: Resume,
    job: JobPosting,
    analysis: JobAnalysis | null,
    opts: { applicationId?: string | null; signal?: AbortSignal } = {},
  ): Promise<InterviewPrep> {
    const resumeText =
      resume.origin.rawText || profileToPlainText(resume.profile);
    const missingRequired =
      analysis?.skills
        .filter((s) => s.quality === "missing" && s.required)
        .map((s) => s.skill) ?? [];
    const partialSkills =
      analysis?.skills
        .filter((s) => s.quality === "partial")
        .map((s) => s.skill) ?? [];

    const result = await runPrompt(
      this.provider,
      interviewPrepPrompt,
      AIInterviewPrep,
      {
        jobTitle: job.title,
        company: job.company,
        description: this.prepare(job.description),
        resumeText: this.prepare(resumeText),
        missingRequired,
        partialSkills,
      },
      {
        maxOutputTokens: 6000,
        ...(opts.signal ? { signal: opts.signal } : {}),
      },
    );

    const now = nowIso();
    return {
      id: createId("prep"),
      jobId: job.id,
      applicationId: opts.applicationId ?? null,
      questions: result.data.questions.map((q) => ({
        id: createId("q"),
        ...q,
      })),
      talkingPoints: result.data.talkingPoints,
      questionsToAsk: result.data.questionsToAsk,
      studyTopics: result.data.studyTopics,
      notes: "",
      completed: [],
      createdAt: now,
      updatedAt: now,
    };
  }
}

interface TextSlot {
  read: () => string;
  write: (value: string) => void;
}

function textSlots(profile: ResumeProfile): TextSlot[] {
  const slots: TextSlot[] = [
    { read: () => profile.summary, write: (v) => (profile.summary = v) },
  ];
  for (const exp of profile.experience) {
    for (const list of [exp.responsibilities, exp.achievements]) {
      list.forEach((_, i) => {
        slots.push({ read: () => list[i]!, write: (v) => (list[i] = v) });
      });
    }
  }
  for (const proj of profile.projects) {
    slots.push({
      read: () => proj.description,
      write: (v) => (proj.description = v),
    });
    proj.highlights.forEach((_, i) => {
      slots.push({
        read: () => proj.highlights[i]!,
        write: (v) => (proj.highlights[i] = v),
      });
    });
  }
  return slots;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export function applyTailorChanges(
  profile: ResumeProfile,
  changes: TailorChange[],
  acceptedIds: string[],
): { profile: ResumeProfile; applied: number; skipped: TailorChange[] } {
  const next: ResumeProfile = structuredClone(profile);
  const slots = textSlots(next);
  const skipped: TailorChange[] = [];
  let applied = 0;

  for (const change of changes.filter((c) => acceptedIds.includes(c.id))) {
    if (!change.original.trim()) {
      if (/summary/i.test(change.section)) {
        next.summary = change.suggested;
        applied++;
      } else skipped.push(change);
      continue;
    }

    const target = squash(change.original);

    let candidates = slots.filter((s) => squash(s.read()) === target);

    if (candidates.length === 0) {
      candidates = slots.filter(
        (s) => s.read().trim() && squash(s.read()).includes(target),
      );
    }

    if (candidates.length !== 1) {
      skipped.push(change);
      continue;
    }

    const slot = candidates[0]!;
    const current = slot.read();
    if (squash(current) === target) {
      slot.write(change.suggested);
    } else {
      const idx = current
        .toLowerCase()
        .indexOf(change.original.trim().toLowerCase());
      slot.write(
        idx >= 0
          ? current.slice(0, idx) +
              change.suggested +
              current.slice(idx + change.original.trim().length)
          : change.suggested,
      );
    }
    applied++;
  }

  return { profile: next, applied, skipped };
}

export function applySkillOrder(
  profile: ResumeProfile,
  order: string[],
): ResumeProfile {
  if (order.length === 0) return profile;
  const rank = new Map(order.map((s, i) => [s.toLowerCase(), i]));
  return {
    ...profile,
    skills: [...profile.skills].sort(
      (a, b) =>
        (rank.get(a.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER),
    ),
  };
}

function asAIError(err: unknown): AIError {
  return err instanceof AIError
    ? err
    : new AIError("unknown", "The AI request failed.");
}
