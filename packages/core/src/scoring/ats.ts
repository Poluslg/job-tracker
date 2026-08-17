import type { AtsAnalysis, KeywordStat } from '@job-ai/types';
import { canonicalizeSkill } from '../skills/taxonomy.ts';
import { clamp, countBy, countTerm, lower, ngrams, tokenize } from '../util/text.ts';

const NOISE = new Set([
  'etc', 'e.g', 'i.e', 'per', 'via', 'may', 'must', 'should', 'would', 'could', 'well', 'like',
  'help', 'make', 'need', 'want', 'looking', 'join', 'apply', 'candidate', 'candidates', 'ideal',
  'opportunity', 'benefits', 'salary', 'office', 'remote', 'hybrid', 'onsite', 'employees',
]);

export function importantKeywords(description: string, limit = 40): Array<{ term: string; count: number; score: number }> {
  const tokens = tokenize(description).filter((t) => !NOISE.has(t));
  const counts = countBy(ngrams(tokens, 3));
  const scored: Array<{ term: string; count: number; score: number }> = [];

  for (const [term, count] of counts) {
    if (count < 2 && !canonicalizeSkill(term)) continue;
    if (term.length < 3) continue;
    const words = term.split(' ').length;
    const isSkill = canonicalizeSkill(term) !== null;
    
    const score = count * (1 + 0.5 * (words - 1)) * (isSkill ? 2.5 : 1);
    scored.push({ term: canonicalizeSkill(term) ?? term, count, score });
  }

  const merged = new Map<string, { term: string; count: number; score: number }>();
  for (const s of scored) {
    const key = s.term.toLowerCase();
    const prev = merged.get(key);
    if (prev) {
      prev.count += s.count;
      prev.score = Math.max(prev.score, s.score);
    } else merged.set(key, { ...s });
  }

  const all = [...merged.values()].sort((a, b) => b.score - a.score);
  const kept: typeof all = [];
  for (const cand of all) {
    const redundant = kept.some(
      (k) => k.term.toLowerCase().includes(cand.term.toLowerCase()) && k.term.length > cand.term.length,
    );
    if (!redundant) kept.push(cand);
    if (kept.length >= limit) break;
  }
  return kept;
}

export interface AtsInput {
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
  
  resumeTitles: string[];
}

function titleAlignment(jobTitle: string, resumeTitles: string[]): { score: number; note: string } {
  const jt = tokenize(jobTitle).filter((t) => !['senior', 'junior', 'staff', 'lead', 'principal', 'ii', 'iii'].includes(t));
  if (jt.length === 0 || resumeTitles.length === 0) {
    return { score: 0, note: 'Not enough information to compare job titles.' };
  }
  let best = 0;
  let bestTitle = '';
  for (const rt of resumeTitles) {
    const rtTokens = new Set(tokenize(rt));
    const overlap = jt.filter((t) => rtTokens.has(t)).length / jt.length;
    if (overlap > best) {
      best = overlap;
      bestTitle = rt;
    }
  }
  const score = clamp(Math.round(best * 100));
  const note =
    score >= 80
      ? `Your title "${bestTitle}" closely matches "${jobTitle}".`
      : score >= 40
        ? `Your closest title is "${bestTitle}". Consider whether your resume makes the overlap with "${jobTitle}" obvious.`
        : `None of your listed titles closely match "${jobTitle}". Make sure your summary bridges the gap honestly.`;
  return { score, note };
}

function detectAtsIssues(resumeText: string): string[] {
  const issues: string[] = [];
  if (!resumeText.trim()) return ['No resume text available to analyze.'];
  if (resumeText.length < 800) {
    issues.push('Your resume text is very short — parsers may have missed content in a complex layout.');
  }
  if (/\t{2,}| {6,}/.test(resumeText)) {
    issues.push('Detected wide column spacing. Multi-column layouts are often reordered by ATS parsers.');
  }
  if (!/\b(experience|employment|work history)\b/i.test(resumeText)) {
    issues.push('No clearly labelled "Experience" section was found. Standard section headings parse more reliably.');
  }
  if (!/\b(education)\b/i.test(resumeText)) {
    issues.push('No clearly labelled "Education" section was found.');
  }
  if (!/[\w.+-]+@[\w-]+\.[\w.]+/.test(resumeText)) {
    issues.push('No email address detected in the resume text.');
  }
  const bulletLines = resumeText.split('\n').filter((l) => /^\s*[•·▪*-]/.test(l)).length;
  if (bulletLines < 3) {
    issues.push('Few bullet points detected. Bulleted achievements parse and scan better than paragraphs.');
  }
  return issues;
}

export function analyzeAts(input: AtsInput): AtsAnalysis {
  const keywords = importantKeywords(input.jobDescription);
  const resumeLower = lower(input.resumeText);
  const jobLower = lower(input.jobDescription);

  const found: KeywordStat[] = [];
  const missing: KeywordStat[] = [];

  for (const [i, k] of keywords.entries()) {
    const inResume = countOccurrences(resumeLower, k.term);
    const stat: KeywordStat = {
      keyword: k.term,
      inJob: countOccurrences(jobLower, k.term) || k.count,
      inResume,
      
      important: i < Math.max(8, Math.floor(keywords.length / 3)),
      unsupported: inResume === 0,
    };
    if (inResume > 0) found.push(stat);
    else missing.push(stat);
  }

  const important = [...found, ...missing].filter((k) => k.important);
  const importantFound = important.filter((k) => k.inResume > 0).length;
  const coverage = important.length
    ? clamp(Math.round((importantFound / important.length) * 100))
    : 0;

  const title = titleAlignment(input.jobTitle, input.resumeTitles);

  return {
    coverage,
    found: found.sort((a, b) => b.inJob - a.inJob),
    missing: missing.sort((a, b) => b.inJob - a.inJob),
    titleAlignment: title.score,
    titleNote: title.note,
    issues: detectAtsIssues(input.resumeText),
  };
}

function countOccurrences(haystackLower: string, term: string): number {
  return countTerm(haystackLower, term);
}
