import {
  CORE_RULES,
  LIMITS,
  UNTRUSTED_CONTENT_RULES,
  cap,
  fence,
  type PromptTemplate,
} from "./shared.ts";

export interface TailorResumeInput {
  jobTitle: string;
  company: string;
  description: string;
  resumeText: string;
  currentSummary: string;
  strongSkills: string[];
  partialSkills: string[];
  acceptedRecommendations: string[];
}

export const tailorResumePrompt: PromptTemplate<TailorResumeInput> = {
  task: "tailor-resume",
  version: "1.0.0",
  system: `${CORE_RULES}

${UNTRUSTED_CONTENT_RULES}

TASK: Propose edits that make an existing resume land better for one specific job.

What you may do:
- Rewrite an existing bullet to lead with the part this job cares about.
- Use the posting's vocabulary for work the resume already describes in other words.
- Reorder skills so relevant ones come first.
- Rewrite the summary to target this role, using only facts already in the resume.
- Recommend cutting content that is irrelevant to this posting.

What you may NOT do:
- Add a technology, responsibility, employer, title, date, credential or metric that is not already in the resume.
- Turn a vague statement into a specific one by inventing the specifics. If a bullet would be stronger with a number, propose the rewrite with a clear placeholder and set "needsUserConfirmation": true.
- Escalate scope ("contributed to" must not become "led").

For every change, "original" must be the exact existing text (empty only for a genuinely new summary). Put anything you wanted to claim but could not verify into "unverifiable" instead of into a change.`,

  build(input) {
    const job = fence(
      "job-description",
      cap(input.description, LIMITS.jobDescription, "Job description"),
    );
    const resume = fence(
      "resume",
      cap(input.resumeText, LIMITS.resumeText, "Resume"),
    );

    return `Target role: ${input.jobTitle} at ${input.company}

Skills the resume already evidences for this role: ${input.strongSkills.join(", ") || "(none)"}
Skills where the resume shows only adjacent experience: ${input.partialSkills.join(", ") || "(none)"}

The user explicitly asked for these improvements:
${input.acceptedRecommendations.map((r) => `- ${r}`).join("\n") || "- (no specific requests; use your judgement within the rules)"}

Current summary section: ${input.currentSummary || "(none)"}

Job description:
${job.block}

Resume:
${resume.block}

Return JSON: { "summary": "...", "skillOrder": [...], "changes": [{ "section", "original", "suggested", "reason", "needsUserConfirmation" }], "unverifiable": [...] }`;
  },
};
