import type { JobRequirement, ResumeProfile, SkillMatch } from '@job-ai/types';
import { ancestorsOf, canonicalizeSkill, descendantsOf, detectSkills } from '../skills/taxonomy.ts';
import { findEvidence } from '../util/text.ts';

export interface ResumeSkillIndex {
  
  skills: Map<string, string[]>;
  
  text: string;
}

export function profileToText(profile: ResumeProfile): string {
  const parts: string[] = [profile.summary];
  parts.push(profile.skills.map((s) => s.name).join(', '));
  for (const e of profile.experience) {
    parts.push(`${e.title} at ${e.company}`);
    parts.push(...e.responsibilities, ...e.achievements, e.technologies.join(', '));
  }
  for (const p of profile.projects) {
    parts.push(`${p.name}: ${p.description}`, ...p.highlights, p.technologies.join(', '));
  }
  for (const ed of profile.education) {
    parts.push(`${ed.degree} ${ed.field} ${ed.institution}`, ...ed.highlights);
  }
  for (const c of profile.certifications) parts.push(`${c.name} ${c.issuer}`);
  parts.push(profile.languages.join(', '));
  return parts.filter(Boolean).join('\n');
}

export function buildResumeSkillIndex(profile: ResumeProfile, rawText = ''): ResumeSkillIndex {
  const text = [profileToText(profile), rawText].filter(Boolean).join('\n');
  const skills = new Map<string, string[]>();

  const add = (canonical: string) => {
    if (!skills.has(canonical)) skills.set(canonical, findEvidence(text, canonical));
  };

  for (const s of profile.skills) {
    const c = canonicalizeSkill(s.name);
    if (c) add(c);
    else if (!skills.has(s.name)) skills.set(s.name, []);
  }
  
  for (const c of detectSkills(text)) add(c);

  return { skills, text };
}

function has(index: ResumeSkillIndex, skill: string): boolean {
  return index.skills.has(skill);
}

export function matchSkill(
  index: ResumeSkillIndex,
  skill: string,
  required: boolean,
  jobText: string,
): SkillMatch {
  const jobEvidence = findEvidence(jobText, skill, 1);

  if (has(index, skill)) {
    return {
      skill,
      quality: 'strong',
      required,
      resumeEvidence: index.skills.get(skill) ?? [],
      jobEvidence,
      rationale: 'Found directly in your resume.',
    };
  }

  const specific = descendantsOf(skill).find((d) => has(index, d));
  if (specific) {
    return {
      skill,
      quality: 'strong',
      required,
      resumeEvidence: index.skills.get(specific) ?? [],
      jobEvidence,
      rationale: `Your resume shows ${specific}, which demonstrates ${skill}.`,
    };
  }

  const broader = ancestorsOf(skill).find((a) => has(index, a));
  if (broader) {
    return {
      skill,
      quality: 'partial',
      required,
      resumeEvidence: index.skills.get(broader) ?? [],
      jobEvidence,
      rationale: `Your resume shows ${broader}, but not ${skill} specifically.`,
    };
  }

  return {
    skill,
    quality: 'missing',
    required,
    resumeEvidence: [],
    jobEvidence,
    rationale: 'Not found in your resume.',
  };
}

export interface SkillComparison {
  matches: SkillMatch[];
  requiredSkills: string[];
  preferredSkills: string[];
}

export function compareSkills(
  index: ResumeSkillIndex,
  requirements: JobRequirement[],
  jobDescription: string,
): SkillComparison {
  const required = new Set<string>();
  const preferred = new Set<string>();

  for (const r of requirements) {
    const target = r.kind === 'nice-to-have' ? preferred : r.kind === 'must-have' ? required : null;
    if (!target) continue;
    for (const s of r.skills) target.add(s);
  }

  for (const s of detectSkills(jobDescription)) {
    if (!required.has(s)) preferred.add(s);
  }
  for (const s of required) preferred.delete(s);

  const matches: SkillMatch[] = [
    ...[...required].map((s) => matchSkill(index, s, true, jobDescription)),
    ...[...preferred].map((s) => matchSkill(index, s, false, jobDescription)),
  ];

  return {
    matches,
    requiredSkills: [...required],
    preferredSkills: [...preferred],
  };
}

export function coverageScore(matches: SkillMatch[]): number {
  if (matches.length === 0) return 0;
  const earned = matches.reduce(
    (sum, m) => sum + (m.quality === 'strong' ? 1 : m.quality === 'partial' ? 0.5 : 0),
    0,
  );
  return (earned / matches.length) * 100;
}
