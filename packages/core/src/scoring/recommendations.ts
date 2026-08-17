import type {
  AtsAnalysis,
  Concern,
  ExperienceAlignment,
  Recommendation,
  ResumeProfile,
  SkillMatch,
} from "@job-ai/types";
import { createId } from "../util/id.ts";

export interface RecommendationInput {
  profile: ResumeProfile;
  matches: SkillMatch[];
  ats: AtsAnalysis;
  experience: ExperienceAlignment;
  uncoveredResponsibilities: string[];
  jobTitle: string;
}

const METRIC_PATTERN =
  /\d+\s*(%|percent|x\b|k\b|m\b|ms\b|users|requests|customers|hours|weeks|days)/i;

export function buildRecommendations(
  input: RecommendationInput,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const push = (r: Omit<Recommendation, "id">) =>
    recs.push({ id: createId("rec"), ...r });

  const partials = input.matches.filter(
    (m) => m.quality === "partial" && m.required,
  );
  if (partials.length) {
    push({
      kind: "add-terminology",
      title: `Make ${partials.length} partial match${partials.length > 1 ? "es" : ""} explicit`,
      detail:
        `The posting asks for ${partials.map((p) => p.skill).join(", ")}. Your resume shows related work but not the exact term. ` +
        "If you have genuinely used these, name them directly in the relevant bullet. Do not add a term you have not worked with.",
      priority: "high",
      needsUserConfirmation: true,
    });
  }

  const missingRequired = input.matches.filter(
    (m) => m.quality === "missing" && m.required,
  );
  if (missingRequired.length) {
    push({
      kind: "highlight-project",
      title: "Address the required skills you do not currently evidence",
      detail:
        `Not found in your resume: ${missingRequired.map((m) => m.skill).join(", ")}. ` +
        "If you have relevant coursework, side projects, or adjacent production work, add a concrete example. " +
        "If you have not used these, leave them out — a gap you can speak to honestly beats a claim you cannot defend.",
      priority: "high",
      needsUserConfirmation: true,
    });
  }

  const strongSkills = input.matches
    .filter((m) => m.quality === "strong" && m.required)
    .map((m) => m.skill);
  const topListed = input.profile.skills
    .slice(0, 8)
    .map((s) => s.name.toLowerCase());
  const buried = strongSkills.filter(
    (s) => !topListed.includes(s.toLowerCase()),
  );
  if (buried.length) {
    push({
      kind: "reorder-skills",
      title: "Move your matching skills higher",
      detail: `${buried.join(", ")} match this role but are not near the top of your skills section. Reordering costs nothing and helps both recruiters and keyword scans.`,
      priority: "medium",
      needsUserConfirmation: false,
    });
  }

  const bullets = input.profile.experience.flatMap((e) => [
    ...e.responsibilities,
    ...e.achievements,
  ]);
  const quantified = bullets.filter((b) => METRIC_PATTERN.test(b)).length;
  if (bullets.length > 0 && quantified / bullets.length < 0.3) {
    push({
      kind: "add-achievement",
      title: "Quantify more of your bullet points",
      detail: `Only ${quantified} of ${bullets.length} bullets contain a measurable outcome. Add real numbers you can stand behind — scale, latency, revenue, users, time saved. Leave a bullet unquantified rather than estimating a figure you do not know.`,
      priority: "medium",
      needsUserConfirmation: true,
    });
  }

  if (!input.profile.summary || input.profile.summary.length < 80) {
    push({
      kind: "improve-summary",
      title: "Add a targeted professional summary",
      detail: `A short summary naming your discipline, years of experience and 3-4 core technologies gives both a recruiter and a parser an immediate anchor for a ${input.jobTitle} application.`,
      priority: "medium",
      needsUserConfirmation: false,
    });
  }

  if (input.uncoveredResponsibilities.length) {
    push({
      kind: "clarify-responsibility",
      title: "Speak to the responsibilities you already do",
      detail: `These day-to-day responsibilities are not reflected in your resume: ${input.uncoveredResponsibilities
        .slice(0, 3)
        .map((r) => `"${r.slice(0, 90)}"`)
        .join(
          "; ",
        )}. If your current work covers any of them, rewrite an existing bullet to say so plainly.`,
      priority: "medium",
      needsUserConfirmation: true,
    });
  }

  if (input.ats.titleAlignment < 50) {
    push({
      kind: "title-alignment",
      title: "Bridge the job-title gap",
      detail: `${input.ats.titleNote} Your summary line is the right place to state the equivalence — for example, describing the scope of your current role in the language this posting uses.`,
      priority: input.ats.titleAlignment < 25 ? "high" : "low",
      needsUserConfirmation: false,
    });
  }

  if (input.ats.issues.length) {
    push({
      kind: "improve-bullet",
      title: "Fix resume parsing issues",
      detail: input.ats.issues.join(" "),
      priority: "medium",
      needsUserConfirmation: false,
    });
  }

  const irrelevant = input.profile.skills.filter(
    (s) =>
      !input.matches.some(
        (m) => m.skill.toLowerCase() === s.name.toLowerCase(),
      ),
  );
  if (irrelevant.length > 12) {
    push({
      kind: "remove-irrelevant",
      title: "Trim skills that do not apply here",
      detail: `${irrelevant.length} of your listed skills have no counterpart in this posting. A shorter, sharper list reads better — keep the full list in your general resume version.`,
      priority: "low",
      needsUserConfirmation: false,
    });
  }

  const priorityRank = { high: 0, medium: 1, low: 2 } as const;
  return recs.sort(
    (a, b) => priorityRank[a.priority] - priorityRank[b.priority],
  );
}

export function buildConcerns(input: RecommendationInput): Concern[] {
  const concerns: Concern[] = [];
  const missingRequired = input.matches.filter(
    (m) => m.quality === "missing" && m.required,
  );

  if (missingRequired.length >= 3) {
    concerns.push({
      text: `${missingRequired.length} stated requirements are not evidenced anywhere in your resume: ${missingRequired
        .map((m) => m.skill)
        .join(", ")}.`,
      severity: "high",
      inferred: false,
    });
  }
  if (input.experience.verdict === "below") {
    concerns.push({
      text: `The posting asks for ${input.experience.requiredYears}+ years; your resume shows about ${input.experience.resumeYears}.`,
      severity: "medium",
      inferred: false,
    });
  }
  if (input.experience.verdict === "unknown") {
    concerns.push({
      text: "We could not read employment dates from your resume, so experience alignment is an estimate. Correcting the dates in your profile will improve accuracy.",
      severity: "low",
      inferred: false,
    });
  }
  if (input.ats.coverage < 50) {
    concerns.push({
      text: `Only ${input.ats.coverage}% of the posting's most important terms appear in your resume. Review the missing list and add the ones your experience genuinely supports.`,
      severity: "medium",
      inferred: false,
    });
  }
  return concerns;
}
