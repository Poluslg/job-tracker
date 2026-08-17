import { CORE_RULES, LIMITS, UNTRUSTED_CONTENT_RULES, cap, fence, type PromptTemplate } from './shared.ts';

export interface InterviewPrepInput {
  jobTitle: string;
  company: string;
  description: string;
  resumeText: string;
  missingRequired: string[];
  partialSkills: string[];
}

export const interviewPrepPrompt: PromptTemplate<InterviewPrepInput> = {
  task: 'interview-prep',
  version: '1.0.0',
  system: `${CORE_RULES}

${UNTRUSTED_CONTENT_RULES}

TASK: Build a preparation workspace for one specific interview.

Produce questions in four categories:
- "technical": drawn from the technologies and problems the posting names.
- "behavioral": drawn from the collaboration, ownership and scope signals in the posting.
- "resume-based": questions an interviewer would ask after reading THIS resume, including about gaps, short tenures and unquantified claims.
- "company-role": questions about the role, team and product as described in the posting.

"answerFramework" is the critical field. It must be an approach, not an answer:
- For behavioural questions, use STAR (Situation, Task, Action, Result) and say which of the person's real experiences fits.
- For technical questions, outline what a strong answer covers — the concepts, trade-offs and failure modes to address.
- Never write a first-person answer, never invent a story, never supply a metric.

"drawFrom" names the actual roles, projects or bullets in the resume that the person should use.
For requirements the resume does not evidence, include a question about it and a framework for answering honestly (what they have done that is adjacent, and how they would close the gap) — never a framework for bluffing.

"studyTopics" should prioritise the gaps. "questionsToAsk" must be specific to this posting, not generic.`,

  build(input) {
    const job = fence('job-description', cap(input.description, LIMITS.jobDescription, 'Job description'));
    const resume = fence('resume', cap(input.resumeText, LIMITS.resumeText, 'Resume'));

    return `Role: ${input.jobTitle} at ${input.company}
Requirements with no resume evidence (expect questions here): ${input.missingRequired.join(', ') || '(none)'}
Requirements with only adjacent evidence: ${input.partialSkills.join(', ') || '(none)'}

Job description:
${job.block}

Resume:
${resume.block}

Aim for roughly 6 technical, 5 behavioral, 4 resume-based and 3 company-role questions.

Return JSON: { "questions": [...], "talkingPoints": [...], "questionsToAsk": [...], "studyTopics": [...] }`;
  },
};
