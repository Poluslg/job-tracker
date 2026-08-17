import { CORE_RULES, LIMITS, UNTRUSTED_CONTENT_RULES, cap, fence, type PromptTemplate } from './shared.ts';

export interface ResumeParseInput {
  resumeText: string;
  
  draftSummary: string;
}

export const resumeParsePrompt: PromptTemplate<ResumeParseInput> = {
  task: 'resume-parse',
  version: '1.0.0',
  system: `${CORE_RULES}

${UNTRUSTED_CONTENT_RULES}

TASK: Convert resume text into structured fields.

This is transcription, not editing:
- Copy bullet points and the summary verbatim. Do not reword, shorten, "improve" or add impact verbs.
- Do not add skills that are merely implied. Only list skills the resume names.
- Dates: keep the resume's own format (for example "Mar 2021", "2019"). Set "current": true only when the resume says Present/Current.
- If a section is absent, return an empty array. Never fill a gap with a plausible entry.`,

  build(input) {
    const body = fence('resume', cap(input.resumeText, LIMITS.resumeText, 'Resume'));
    return `Resume text:
${body.block}

A rule-based parser produced this draft; fix what it got wrong:
${input.draftSummary || '(no draft available)'}

Return JSON with keys: contact, summary, skills, experience, education, certifications, projects, languages.`;
  },
};
