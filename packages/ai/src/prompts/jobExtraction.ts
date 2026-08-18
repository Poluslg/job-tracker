import {
  CORE_RULES,
  LIMITS,
  UNTRUSTED_CONTENT_RULES,
  cap,
  fence,
  type PromptTemplate,
} from "./shared.ts";

export interface JobExtractionInput {
  url: string;
  pageTitle: string;
  pageText: string;
}

export const jobExtractionPrompt: PromptTemplate<JobExtractionInput> = {
  task: "job-extraction",
  version: "1.0.0",
  system: `${CORE_RULES}

${UNTRUSTED_CONTENT_RULES}

TASK: Decide whether the captured page text is a single job posting, and if so pull out its top-level fields.
- Copy values verbatim from the text. Do not normalise, embellish or translate.
- If a field is not present, return an empty string rather than a guess.
- Set "isJobPosting" to false for search-result lists, company home pages, login walls and application forms.`,

  build(input) {
    const page = fence(
      "page-content",
      cap(input.pageText, LIMITS.pageText, "Page text"),
    );
    return `URL (for context only): ${input.url}
Page title (for context only): ${input.pageTitle}

Captured page text:
${page.block}

Return JSON with keys: title, company, location, employmentType, arrangement, salaryText, isJobPosting.`;
  },
};

export interface RequirementsInput {
  jobTitle: string;
  description: string;

  existing: Array<{ text: string; kind: string }>;
}

export const requirementsPrompt: PromptTemplate<RequirementsInput> = {
  task: "requirements",
  version: "1.0.0",
  system: `${CORE_RULES}

${UNTRUSTED_CONTENT_RULES}

TASK: Break a job description into discrete requirements.
Classify each into exactly one kind:
- "must-have": stated as required, minimum or expected.
- "nice-to-have": stated as preferred, bonus, a plus, or ideal.
- "responsibility": something the person will actually do in the role.
- "signal": an expectation you INFER but which the posting does not state outright (for example, "ships alone" implied by a one-person team). Use this sparingly; it is shown to the user as interpretation, not fact.

Rules:
- Keep the original wording for "text". Do not rewrite the employer's words.
- "skills" must list only concrete named technologies, tools or disciplines that appear in that requirement.
- "yearsRequired" is a number only when the requirement states one; otherwise null.`,

  build(input) {
    const body = fence(
      "job-description",
      cap(input.description, LIMITS.jobDescription, "Job description"),
    );
    const already = input.existing
      .slice(0, 40)
      .map((r) => `- (${r.kind}) ${r.text.slice(0, 160)}`)
      .join("\n");

    return `Job title: ${input.jobTitle}

Job description:
${body.block}

A rule-based parser already produced this draft. Correct misclassifications, merge duplicates, and add anything it missed:
${already || "(none)"}

Return JSON: { "requirements": [{ "text", "kind", "skills", "yearsRequired" }] }`;
  },
};
