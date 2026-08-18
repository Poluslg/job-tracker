import type {
  JobAnalysis,
  JobPosting,
  ResumeProfile,
  ScoreBreakdown,
  ScoreComponent,
  ScoringWeights,
  SkillMatch,
} from "@job-ai/types";
import { DEFAULT_SETTINGS } from "@job-ai/types";
import { extractRequirements } from "../extraction/requirements.ts";
import { analyzeDomain, analyzeResponsibilities } from "./alignment.ts";
import { analyzeAts } from "./ats.ts";
import { analyzeEducation, analyzeExperience } from "./experience.ts";
import { buildConcerns, buildRecommendations } from "./recommendations.ts";
import {
  buildResumeSkillIndex,
  compareSkills,
  coverageScore,
} from "./skills.ts";
import { createId } from "../util/id.ts";
import { clamp, round } from "../util/text.ts";
import { nowIso } from "@job-ai/types";

export const SCORING_ENGINE_VERSION = "1.0.0";

export interface ScoreInput {
  profile: ResumeProfile;
  resumeText: string;
  job: Pick<JobPosting, "title" | "company" | "description"> &
    Partial<JobPosting>;
  weights?: ScoringWeights;
}

const COMPONENT_LABELS: Record<ScoreComponent["key"], string> = {
  requiredSkills: "Required skills",
  preferredSkills: "Preferred skills",
  experience: "Experience",
  responsibilities: "Responsibilities",
  keywords: "Keyword / ATS coverage",
  education: "Education & certifications",
  domain: "Domain alignment",
};

export function normalizeWeights(weights: ScoringWeights): ScoringWeights {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total <= 0) return DEFAULT_SETTINGS.scoring;
  const out = {} as ScoringWeights;
  for (const [k, v] of Object.entries(weights) as Array<
    [keyof ScoringWeights, number]
  >) {
    out[k] = v / total;
  }
  return out;
}

export function computeAnalysis(
  input: ScoreInput,
): Omit<JobAnalysis, "id" | "jobId" | "resumeId" | "createdAt" | "updatedAt"> {
  const weights = normalizeWeights(input.weights ?? DEFAULT_SETTINGS.scoring);
  const description = input.job.description ?? "";
  const requirements = input.job.requirements?.length
    ? input.job.requirements
    : extractRequirements(description);

  const index = buildResumeSkillIndex(input.profile, input.resumeText);
  const { matches } = compareSkills(index, requirements, description);

  const requiredMatches = matches.filter((m) => m.required);
  const preferredMatches = matches.filter((m) => !m.required);

  const requiredScore = requiredMatches.length
    ? coverageScore(requiredMatches)
    : 65;
  const preferredScore = preferredMatches.length
    ? coverageScore(preferredMatches)
    : 65;

  const experience = analyzeExperience(input.profile, requirements);
  const education = analyzeEducation(input.profile, description);
  const responsibilities = analyzeResponsibilities(index, requirements);
  const domain = analyzeDomain(index.text, description);

  const ats = analyzeAts({
    jobTitle: input.job.title ?? "",
    jobDescription: description,
    resumeText: index.text,
    resumeTitles: input.profile.experience.map((e) => e.title).filter(Boolean),
  });

  const components: ScoreComponent[] = [
    {
      key: "requiredSkills",
      label: COMPONENT_LABELS.requiredSkills,
      score: round(requiredScore),
      weight: weights.requiredSkills,
      explanation: requiredMatches.length
        ? `${countQ(requiredMatches, "strong")} of ${requiredMatches.length} required skills matched directly, ${countQ(requiredMatches, "partial")} partially. Partial matches count as half.`
        : "No explicit required skills were detected in this posting, so this component uses a neutral baseline.",
      details: requiredMatches.map((m) => `${m.skill} — ${m.quality}`),
    },
    {
      key: "preferredSkills",
      label: COMPONENT_LABELS.preferredSkills,
      score: round(preferredScore),
      weight: weights.preferredSkills,
      explanation: preferredMatches.length
        ? `${countQ(preferredMatches, "strong")} of ${preferredMatches.length} preferred or contextual skills matched.`
        : "No preferred skills were detected, so this component uses a neutral baseline.",
      details: preferredMatches.map((m) => `${m.skill} — ${m.quality}`),
    },
    {
      key: "experience",
      label: COMPONENT_LABELS.experience,
      score: round(experience.score),
      weight: weights.experience,
      explanation: experience.alignment.note,
      details: experience.alignment.relevantTitles,
    },
    {
      key: "responsibilities",
      label: COMPONENT_LABELS.responsibilities,
      score: round(responsibilities.score),
      weight: weights.responsibilities,
      explanation: responsibilities.uncovered.length
        ? `${responsibilities.covered.length} of ${responsibilities.covered.length + responsibilities.uncovered.length} listed responsibilities are reflected in your resume.`
        : "Your resume reflects the responsibilities described in the posting.",
      details: responsibilities.uncovered
        .slice(0, 5)
        .map((r) => `Not evidenced: ${r.slice(0, 120)}`),
    },
    {
      key: "keywords",
      label: COMPONENT_LABELS.keywords,
      score: round(ats.coverage),
      weight: weights.keywords,
      explanation: `${ats.coverage}% of the posting's highest-signal terms appear somewhere in your resume.`,
      details: ats.missing
        .filter((k) => k.important)
        .slice(0, 8)
        .map((k) => `Missing: ${k.keyword}`),
    },
    {
      key: "education",
      label: COMPONENT_LABELS.education,
      score: round(education.score),
      weight: weights.education,
      explanation: education.alignment.note,
      details: education.alignment.matchedCredentials,
    },
    {
      key: "domain",
      label: COMPONENT_LABELS.domain,
      score: round(domain.score),
      weight: weights.domain,
      explanation: domain.note,
      details: domain.jobDomains,
    },
  ];

  const overall = clamp(
    Math.round(components.reduce((sum, c) => sum + c.score * c.weight, 0)),
  );

  const score: ScoreBreakdown = {
    overall,
    components,
    engineVersion: SCORING_ENGINE_VERSION,
  };

  const recInput = {
    profile: input.profile,
    matches,
    ats,
    experience: experience.alignment,
    uncoveredResponsibilities: responsibilities.uncovered,
    jobTitle: input.job.title ?? "this role",
  };

  return {
    resumeVersionId: null,
    score,
    skills: sortMatches(matches),
    ats,
    experience: experience.alignment,
    education: education.alignment,
    recommendations: buildRecommendations(recInput),
    concerns: buildConcerns(recInput),
    requirementCoverage: responsibilities.coverage,
    mode: "local",
    modelUsed: "",
    promptVersion: "",
    confidence: confidenceFor(
      description,
      input.resumeText,
      requirements.length,
    ),
  };
}

function countQ(matches: SkillMatch[], q: SkillMatch["quality"]): number {
  return matches.filter((m) => m.quality === q).length;
}

function sortMatches(matches: SkillMatch[]): SkillMatch[] {
  const rank = { strong: 0, partial: 1, missing: 2 } as const;
  return [...matches].sort(
    (a, b) =>
      Number(b.required) - Number(a.required) ||
      rank[a.quality] - rank[b.quality] ||
      a.skill.localeCompare(b.skill),
  );
}

function confidenceFor(
  description: string,
  resumeText: string,
  reqCount: number,
): "high" | "medium" | "low" {
  if (description.length < 400 || resumeText.length < 400) return "low";
  if (reqCount >= 6 && description.length > 1200) return "high";
  return "medium";
}

export function toAnalysisRecord(
  partial: ReturnType<typeof computeAnalysis>,
  jobId: string,
  resumeId: string,
): JobAnalysis {
  const now = nowIso();
  return {
    id: createId("an"),
    jobId,
    resumeId,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function scoreBand(score: number): {
  label: string;
  tone: "strong" | "good" | "fair" | "low";
} {
  if (score >= 80) return { label: "Strong match", tone: "strong" };
  if (score >= 65) return { label: "Good match", tone: "good" };
  if (score >= 45) return { label: "Partial match", tone: "fair" };
  return { label: "Limited match", tone: "low" };
}

export const SCORE_DISCLAIMER =
  "This is an analytical estimate of how well your resume aligns with this posting. It is not a prediction of whether you will be contacted, interviewed or hired.";
