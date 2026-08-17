import {
  CORE_RULES,
  LIMITS,
  UNTRUSTED_CONTENT_RULES,
  cap,
  fence,
  type PromptTemplate,
} from "./shared.ts";

export interface MatchInsightsInput {
  jobTitle: string;
  company: string;
  description: string;
  resumeText: string;

  score: number;
  strongSkills: string[];
  partialSkills: Array<{ skill: string; rationale: string }>;
  missingRequired: string[];
  experienceNote: string;
  atsCoverage: number;
}

export const matchInsightsPrompt: PromptTemplate<MatchInsightsInput> = {
  task: "match-insights",
  version: "1.0.0",
  system: `${CORE_RULES}

${UNTRUSTED_CONTENT_RULES}

TASK: Explain a job match that has already been scored, and give specific, honest advice.

You do NOT calculate or revise the score. It was computed deterministically and is given to you.

Produce four things:
1. "hiddenSignals" — expectations implied but not stated by the posting. Each one is your interpretation; write it so a reader understands it is a reading of the text, not a listed requirement.
2. "concerns" — real gaps between this resume and this posting. Be direct and specific. Do not soften a genuine gap, and do not invent one.
3. "recommendations" — concrete edits to the resume. Each must point at something already in the resume. Set "needsUserConfirmation" to true whenever acting on the advice would require a fact you cannot see (a metric, an outcome, an unlisted tool).
4. "terminologyBridges" — places where the resume and the posting describe the same real work with different words. Only when the underlying experience is genuinely present.

Never suggest adding a skill, tool or achievement the resume does not evidence. If the person lacks a requirement, say so plainly and suggest how to speak to it honestly instead.`,

  build(input) {
    const job = fence(
      "job-description",
      cap(input.description, LIMITS.jobDescription, "Job description"),
    );
    const resume = fence(
      "resume",
      cap(input.resumeText, LIMITS.resumeText, "Resume"),
    );

    return `Role: ${input.jobTitle} at ${input.company}

Deterministic analysis (facts — do not recompute):
- Overall match score: ${input.score}/100
- ATS keyword coverage: ${input.atsCoverage}%
- Experience: ${input.experienceNote}
- Strong skill matches: ${input.strongSkills.join(", ") || "(none)"}
- Partial matches: ${input.partialSkills.map((p) => `${p.skill} (${p.rationale})`).join("; ") || "(none)"}
- Required skills with no resume evidence: ${input.missingRequired.join(", ") || "(none)"}

Job description:
${job.block}

Resume:
${resume.block}

Return JSON: { "hiddenSignals": [...], "concerns": [...], "recommendations": [...], "terminologyBridges": [...] }`;
  },
};
