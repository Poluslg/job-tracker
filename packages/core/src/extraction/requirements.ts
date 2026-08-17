import type { JobRequirement, RequirementKind } from '@job-ai/types';
import { createId } from '../util/id.ts';
import { detectSkills } from '../skills/taxonomy.ts';
import { lower, toLines } from '../util/text.ts';

const SECTION_CUES: Array<{ kind: RequirementKind; patterns: RegExp }> = [
  {
    kind: 'must-have',
    patterns:
      /^(what you(?:'ll| will)? need|requirements?|qualifications?|minimum qualifications?|basic qualifications?|must[- ]haves?|who you are|what we(?:'re| are) looking for|required skills?|你需要)/i,
  },
  {
    kind: 'nice-to-have',
    patterns:
      /^(nice[- ]to[- ]haves?|preferred|preferred qualifications?|bonus( points)?|desired|plus(es)?|good to have|additional qualifications?)/i,
  },
  {
    kind: 'responsibility',
    patterns:
      /^(what you(?:'ll| will)? do|responsibilities|the role|your (impact|role)|day[- ]to[- ]day|about the (role|job)|duties|key responsibilities)/i,
  },
];

const MUST_INLINE = /\b(must have|required|require[sd]?|you have|minimum of|at least|proven|demonstrated|strong (background|experience))\b/i;
const NICE_INLINE = /\b(nice to have|preferred|bonus|a plus|ideally|desirable|familiarity with|exposure to)\b/i;
const RESP_INLINE = /^(design|build|develop|implement|own|lead|drive|collaborate|partner|maintain|ship|deliver|support|mentor|write|create|improve|scale|monitor|manage|work with|contribute)\b/i;

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

export function extractYears(text: string): number | null {
  const digit = text.match(/(\d{1,2})\s*\+?\s*(?:-|to)?\s*(?:\d{1,2})?\s*\+?\s*(?:years?|yrs?)\b/i);
  if (digit?.[1]) {
    const n = Number(digit[1]);
    if (n > 0 && n <= 40) return n;
  }
  const word = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:\+\s*)?years?\b/i);
  const key = word?.[1]?.toLowerCase();
  if (key && WORD_NUMBERS[key]) return WORD_NUMBERS[key];
  return null;
}

function looksLikeBoilerplate(line: string): boolean {
  const l = lower(line);
  return (
    l.length < 12 ||
    l.length > 400 ||
    /^(apply|submit|equal opportunity|we are an equal|benefits|salary|compensation|about (us|the company)|privacy|cookie|share this|copyright|©)/i.test(
      l,
    )
  );
}

export function extractRequirements(description: string): JobRequirement[] {
  const lines = toLines(description);
  const out: JobRequirement[] = [];
  let section: RequirementKind | null = null;
  const seen = new Set<string>();

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();

    if (line.length <= 80) {
      const cue = SECTION_CUES.find((c) => c.patterns.test(line.replace(/[:：]$/, '')));
      if (cue) {
        section = cue.kind;
        continue;
      }
    }

    if (looksLikeBoilerplate(line)) continue;

    let kind: RequirementKind;
    let confidence: 'high' | 'medium' | 'low';

    if (NICE_INLINE.test(line)) {
      kind = 'nice-to-have';
      confidence = 'high';
    } else if (MUST_INLINE.test(line)) {
      kind = 'must-have';
      confidence = 'high';
    } else if (section) {
      kind = section;
      confidence = 'medium';
    } else if (RESP_INLINE.test(line)) {
      kind = 'responsibility';
      confidence = 'low';
    } else {
      continue; 
    }

    const key = lower(line);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id: createId('req'),
      text: line,
      kind,
      skills: detectSkills(line),
      yearsRequired: extractYears(line),
      confidence,
    });
  }

  return out;
}

export function requirementsByKind(reqs: JobRequirement[], kind: RequirementKind): JobRequirement[] {
  return reqs.filter((r) => r.kind === kind);
}

export function requiredYears(reqs: JobRequirement[]): number | null {
  const years = reqs
    .filter((r) => r.kind === 'must-have' || r.kind === 'nice-to-have')
    .map((r) => r.yearsRequired)
    .filter((y): y is number => y !== null);
  return years.length ? Math.max(...years) : null;
}
