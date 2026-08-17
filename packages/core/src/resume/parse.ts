import type { Certification, Education, Project, ResumeProfile, ResumeSkill } from '@job-ai/types';
import { ResumeProfile as ResumeProfileSchema } from '@job-ai/types';
import { canonicalizeSkill, detectSkills, getSkillEntry } from '../skills/taxonomy.ts';
import { createId } from '../util/id.ts';
import { normalize } from '../util/text.ts';
import { parseExperience, parseExperienceAnywhere } from './experience.ts';
import {
  DATE_RANGE_RE,
  extractDateRange,
  isBulletLine,
  looksLikeHeading,
  splitSegments,
  stripBulletMarker,
} from './lines.ts';
import { headingFor, splitIntoSections, type SectionKey } from './sections.ts';

export const CONTACT_PATTERNS = {
  email: /[\w.+-]+@[\w-]+\.[\w.]{2,}/,
  phone: /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/,
  linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w%-]+/i,
  github: /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i,
  url: /(?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+(?:\/\S*)?/i,
} as const;

function splitList(text: string): string[] {
  return text
    .split(/[,;|•·]|\s{3,}|\s+\/\s+/)
    .map((s) => s.replace(/^\s*[-–—]\s*/, '').trim())
    .filter((s) => s.length > 1 && s.length < 80);
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

const LOCATION_RE =
  /\b([A-Z][a-zA-Z.'-]+(?:[\s-][A-Z][a-zA-Z.'-]+)*,\s*(?:[A-Z]{2}|[A-Z][a-zA-Z]+))\b/;

/**
 * Parse the contact block.
 *
 * Everything is scanned **line by line** rather than against the joined
 * document. Matching across a joined string is how a location regex ends up
 * capturing a name and a city from two different lines.
 */
function parseContact(lines: string[]): ResumeProfile['contact'] {
  const head = lines.slice(0, 15);
  const headText = head.join('\n');
  const allText = lines.join('\n');

  const email = headText.match(CONTACT_PATTERNS.email)?.[0] ?? allText.match(CONTACT_PATTERNS.email)?.[0] ?? '';
  const linkedin = allText.match(CONTACT_PATTERNS.linkedin)?.[0] ?? '';
  const github = allText.match(CONTACT_PATTERNS.github)?.[0] ?? '';

  // Phone: only trust the header block, and only with enough digits that it
  // cannot be a date range or a street number.
  let phone = '';
  for (const line of head) {
    for (const candidate of splitSegments(line)) {
      if (DATE_RANGE_RE.test(candidate)) continue;
      const match = candidate.match(CONTACT_PATTERNS.phone)?.[0] ?? '';
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 9 && digits.length <= 15) {
        phone = match.trim();
        break;
      }
    }
    if (phone) break;
  }

  // Name: the first header line whose leading segment reads like a person's
  // name. Splitting into segments first means "Jane Doe | jane@x.com" works.
  let name = '';
  for (const raw of lines.slice(0, 8)) {
    const line = raw.trim();
    // Only a *recognised* section heading disqualifies a line. An ALL-CAPS name
    // ("MARCUS OKONKWO") also looks like a heading, and skipping it would lose
    // the one field every resume has.
    const heading = headingFor(line);
    if (!line || (heading && heading !== 'other')) continue;

    const candidate = splitSegments(line)[0] ?? '';
    if (!candidate || candidate.length > 60) continue;
    if (CONTACT_PATTERNS.email.test(candidate)) continue;
    if (/\d/.test(candidate)) continue;
    if (/linkedin|github|https?:/i.test(candidate)) continue;

    const words = candidate.split(/\s+/);
    if (words.length < 1 || words.length > 5) continue;
    if (!words.every((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w))) continue;
    // A lone word like "SUMMARY" is a heading, not a name.
    if (words.length === 1 && looksLikeHeading(candidate)) continue;

    name = candidate.replace(/\s{2,}/g, ' ');
    break;
  }

  let location = '';
  for (const raw of head) {
    const line = raw.trim();
    if (!line || DATE_RANGE_RE.test(line)) continue;
    for (const segment of splitSegments(line)) {
      if (/linkedin|github|https?:|@/i.test(segment)) continue;
      const match = segment.match(LOCATION_RE)?.[1];
      const isSkillList = match
        ? match.split(',').some((part) => canonicalizeSkill(part.trim()) !== null)
        : false;
      if (match && match !== name && !isSkillList) {
        location = match.trim();
        break;
      }
    }
    if (location) break;
  }

  const portfolio =
    [...headText.matchAll(new RegExp(CONTACT_PATTERNS.url, 'gi'))]
      .map((m) => m[0])
      .find((u) => /^https?:\/\//i.test(u) && !/linkedin|github/i.test(u)) ?? '';

  return { name, email, phone, location, linkedin, github, portfolio };
}

// ---------------------------------------------------------------------------
// Education
// ---------------------------------------------------------------------------

const DEGREE_RE =
  /\b(b\.?s\.?c?\.?|bachelor(?:'s)?(?:\s+of\s+\w+)?|m\.?s\.?c?\.?|master(?:'s)?(?:\s+of\s+[\w\s]+?)?|ph\.?d\.?|doctorate|associate(?:'s)?|diploma|b\.?tech|m\.?tech|mba|b\.?eng|m\.?eng|b\.?a\.?|m\.?a\.?|b\.?com|m\.?com|b\.?des|m\.?des)\b/i;

const INSTITUTION_RE =
  /\b(university|college|institute|school|academy|polytechnic|universität|universidad|iit|nit|iiit)\b/i;

/**
 * Separate the qualification from the subject.
 *
 * Handles the three forms that cover almost every resume:
 *   "B.S. in Computer Science"        -> B.S.            / Computer Science
 *   "Master of Science, Data Science" -> Master of Science / Data Science
 *   "B.Sc. Computer Science"          -> B.Sc.           / Computer Science
 */
function splitDegreeAndField(segment: string): { degree: string; field: string } {
  const text = segment.trim();

  // "<degree>, <field>" — the comma is the clearest boundary available.
  const comma = text.indexOf(',');
  if (comma > 0) {
    const head = text.slice(0, comma).trim();
    const tail = text.slice(comma + 1).trim();
    if (DEGREE_RE.test(head)) return { degree: head, field: tail };
  }

  // "<degree> in <field>" — note "Master of Science" keeps its own "of".
  const inMatch = text.match(/^(.*?)\s+in\s+(.+)$/i);
  if (inMatch?.[1] && inMatch[2] && DEGREE_RE.test(inMatch[1])) {
    return { degree: inMatch[1].trim(), field: inMatch[2].trim() };
  }

  // "<degree> <field>" with no connective word.
  const degreeMatch = text.match(DEGREE_RE);
  if (degreeMatch) {
    const degree = degreeMatch[0].trim();
    const rest = text.slice((degreeMatch.index ?? 0) + degree.length).replace(/^[\s,:.-]+/, '').trim();
    // "Bachelor of Design" — absorb the trailing "of X" into the degree itself.
    const ofMatch = rest.match(/^of\s+([\w\s]+?)(?:,\s*(.+))?$/i);
    if (ofMatch?.[1]) {
      return { degree: `${degree} of ${ofMatch[1].trim()}`, field: (ofMatch[2] ?? '').trim() };
    }
    return { degree, field: rest };
  }

  return { degree: text, field: '' };
}

function newEducation(): Education {
  return {
    id: createId('edu'),
    degree: '',
    field: '',
    institution: '',
    location: '',
    startDate: '',
    endDate: '',
    gpa: '',
    highlights: [],
  };
}

/**
 * Parse the education section.
 *
 * Entries appear on one line or spread across two or three, in either order
 * (degree first or institution first), so each line contributes whatever it
 * can to the entry being built and a new entry starts only when a slot that is
 * already filled would be overwritten.
 */
function parseEducation(lines: string[]): Education[] {
  const out: Education[] = [];
  let current: Education | null = null;

  const flush = () => {
    if (current && (current.degree || current.institution)) out.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (isBulletLine(line)) {
      current?.highlights.push(stripBulletMarker(line));
      continue;
    }
    if (looksLikeHeading(line)) {
      flush();
      continue;
    }

    const dates = extractDateRange(line);
    const segments = splitSegments(dates.rest);
    const hasDegree = DEGREE_RE.test(line);
    const hasInstitution = INSTITUTION_RE.test(line);
    if (!hasDegree && !hasInstitution && !current) continue;

    // Starting a new entry: this line repeats something already recorded.
    if (current && ((hasDegree && current.degree) || (hasInstitution && current.institution))) {
      flush();
    }
    current ??= newEducation();

    // A single segment can hold both ("B.Eng. Computer Engineering, University
    // of Leeds"), so split on commas when it carries a degree and a school.
    const expanded = segments.flatMap((segment) =>
      DEGREE_RE.test(segment) && INSTITUTION_RE.test(segment)
        ? segment.split(',').map((s) => s.trim()).filter(Boolean)
        : [segment],
    );

    for (const segment of expanded) {
      if (INSTITUTION_RE.test(segment) && !current.institution) {
        current.institution = segment;
        continue;
      }
      if (DEGREE_RE.test(segment) && !current.degree) {
        const { degree, field } = splitDegreeAndField(segment);
        current.degree = degree;
        if (field && !current.field) current.field = field;
        continue;
      }
      if (!current.location && /^[A-Z][\w.'-]*(?:[\s-][\w.'-]+)*,\s*[A-Z][\w.]{1,20}$/.test(segment)) {
        current.location = segment;
        continue;
      }
      if (!current.field && segment.length < 60 && /^[A-Za-z][\w\s&,-]*$/.test(segment) && !current.degree) {
        current.field = segment;
      }
    }

    const gpa = line.match(/\bgpa[:\s]*([\d.]+(?:\s*\/\s*[\d.]+)?)/i)?.[1];
    if (gpa && !current.gpa) current.gpa = gpa;

    if (dates.found) {
      if (!current.startDate) current.startDate = dates.start;
      if (!current.endDate) current.endDate = dates.end;
    }
  }

  flush();
  return out;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

function parseSkills(sectionText: string, fullText: string): ResumeSkill[] {
  const named = new Set<string>();

  for (const line of sectionText.split(/\r?\n/)) {
    // "Languages: Go, Python" — drop the label, keep the list.
    const body = /^[^:]{1,40}:/.test(line) ? line.slice(line.indexOf(':') + 1) : line;
    for (const item of splitList(stripBulletMarker(body))) named.add(item);
  }

  // Catalog detection over the section, or the whole document when there is no
  // skills section at all.
  for (const skill of detectSkills(sectionText || fullText)) named.add(skill);

  const seen = new Set<string>();
  const out: ResumeSkill[] = [];
  for (const raw of named) {
    const canonical = canonicalizeSkill(raw) ?? normalize(raw);
    const key = canonical.toLowerCase();
    if (!canonical || seen.has(key) || canonical.length > 60) continue;
    seen.add(key);
    out.push({
      name: canonical,
      category: getSkillEntry(canonical)?.category ?? 'technical',
      years: null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Projects & certifications
// ---------------------------------------------------------------------------

function parseProjects(lines: string[]): Project[] {
  const out: Project[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length < 5 || looksLikeHeading(line)) continue;

    const text = stripBulletMarker(line);

    if (isBulletLine(line) && out.length) {
      out[out.length - 1]!.highlights.push(text);
      continue;
    }

    const [namePart, ...descParts] = text.split(/\s*[—–:|]\s*/);
    out.push({
      id: createId('proj'),
      name: (namePart ?? '').slice(0, 80),
      description: descParts.join(' — '),
      url: text.match(/(?:https?:\/\/)[\w.-]+\.[a-z]{2,}(?:\/\S*)?/i)?.[0] ?? '',
      technologies: detectSkills(text),
      highlights: [],
    });
  }

  return out;
}

function parseCertifications(lines: string[]): Certification[] {
  return lines
    .map((l) => stripBulletMarker(l).trim())
    .filter((l) => l.length > 3 && !looksLikeHeading(l))
    .map((line) => {
      const segments = splitSegments(line.replace(/\b(19|20)\d{2}\b/, '').replace(/,\s*,/g, ','));
      return {
        id: createId('cert'),
        name: (segments[0] ?? line).slice(0, 120),
        issuer: (segments[1] ?? '').slice(0, 120),
        issued: line.match(/\b(19|20)\d{2}\b/)?.[0] ?? '',
        expires: '',
        credentialId: '',
      };
    });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** How completely a resume parsed, so the UI can ask for help when it's poor. */
export interface ParseQuality {
  score: number;
  missing: string[];
}

export function assessParseQuality(profile: ResumeProfile): ParseQuality {
  const missing: string[] = [];
  let score = 0;

  if (profile.contact.name) score += 10;
  else missing.push('name');

  if (profile.contact.email) score += 10;
  else missing.push('email');

  if (profile.experience.length > 0) score += 25;
  else missing.push('work experience');

  const rolesWithDates = profile.experience.filter((e) => e.startDate).length;
  if (profile.experience.length > 0 && rolesWithDates === profile.experience.length) score += 15;
  else if (rolesWithDates > 0) score += 8;
  else if (profile.experience.length > 0) missing.push('employment dates');

  const rolesComplete = profile.experience.filter((e) => e.title && e.company).length;
  if (profile.experience.length > 0 && rolesComplete === profile.experience.length) score += 15;
  else if (rolesComplete > 0) score += 8;
  else if (profile.experience.length > 0) missing.push('job titles or employers');

  const bullets = profile.experience.reduce(
    (n, e) => n + e.responsibilities.length + e.achievements.length,
    0,
  );
  if (bullets >= 3) score += 10;
  else missing.push('experience bullet points');

  if (profile.skills.length >= 5) score += 10;
  else missing.push('skills');

  if (profile.education.length > 0) score += 5;
  else missing.push('education');

  return { score: Math.min(100, score), missing };
}

/**
 * Deterministic resume parser.
 *
 * Resumes are wildly inconsistent, so this is explicitly best-effort: it never
 * throws, and everything it produces is presented to the user for correction
 * before it is used (`Resume.needsReview`). An optional AI pass can refine the
 * result, but this parser is what makes the product work with no API key.
 *
 * Where a section heading is unrecognised, the parser falls back to scanning
 * the whole document — a resume that labels its jobs "Where I've Worked" still
 * parses.
 */
export function parseResumeText(rawText: string): ResumeProfile {
  const text = rawText
    .replace(/\r\n?/g, '\n')
    .replace(/[   ]/g, ' ')
    .replace(/•/g, '•')
    .replace(/\t/g, '   ')
    // Collapse runs of blank lines but keep one as a paragraph boundary.
    .replace(/\n{3,}/g, '\n\n');

  const lines = text.split('\n');
  const { sections } = splitIntoSections(lines);

  const contact = parseContact(lines);

  // --- experience, with a whole-document fallback --------------------------
  let experience = parseExperience(sections.experience);
  if (experience.length === 0) {
    experience = parseExperienceAnywhere(lines);
  }

  // --- education, with the same fallback -----------------------------------
  let education = parseEducation(sections.education);
  if (education.length === 0) {
    const educationish = lines.filter(
      (l) => DEGREE_RE.test(l) || INSTITUTION_RE.test(l),
    );
    education = parseEducation(educationish);
  }

  // --- summary --------------------------------------------------------------
  let summary = sections.summary
    .map((l) => stripBulletMarker(l).trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 2000);

  if (!summary) {
    // No recognised summary heading: take the first substantial prose block
    // that sits after the contact details and before any dated entry.
    const block: string[] = [];
    for (const raw of lines.slice(0, 30)) {
      const line = raw.trim();
      if (!line) {
        if (block.length) break;
        continue;
      }
      if (headingFor(line) || DATE_RANGE_RE.test(line)) {
        if (block.length) break;
        continue;
      }
      if (CONTACT_PATTERNS.email.test(line) || /linkedin|github|https?:/i.test(line)) continue;
      if (line === contact.name || line === contact.location) continue;
      if (line.length > 40) block.push(line);
      else if (block.length) break;
    }
    summary = block.join(' ').slice(0, 2000);
  }

  const profile: ResumeProfile = {
    contact,
    summary,
    skills: parseSkills(sections.skills.join('\n'), text),
    experience,
    education,
    certifications: parseCertifications(sections.certifications),
    projects: parseProjects(sections.projects),
    languages: [...new Set(sections.languages.flatMap((l) => splitList(stripBulletMarker(l))))],
  };

  // Validate through the schema so downstream code always gets well-formed defaults.
  return ResumeProfileSchema.parse(profile);
}

export type { SectionKey };

/** Render a structured profile back to plain text (exports, diffs, AI context). */
export function profileToPlainText(profile: ResumeProfile): string {
  const out: string[] = [];
  const c = profile.contact;
  if (c.name) out.push(c.name);

  const contactLine = [c.email, c.phone, c.location, c.linkedin, c.github, c.portfolio]
    .filter(Boolean)
    .join(' | ');
  if (contactLine) out.push(contactLine);

  if (profile.summary) out.push('', 'SUMMARY', profile.summary);

  if (profile.skills.length) {
    out.push('', 'SKILLS', profile.skills.map((s) => s.name).join(', '));
  }

  if (profile.experience.length) {
    out.push('', 'EXPERIENCE');
    for (const e of profile.experience) {
      const dates = e.current
        ? `${e.startDate} - Present`
        : [e.startDate, e.endDate].filter(Boolean).join(' - ');
      out.push(
        [e.title, e.company, e.location].filter(Boolean).join(' — ') + (dates ? ` | ${dates}` : ''),
      );
      for (const b of [...e.achievements, ...e.responsibilities]) out.push(`• ${b}`);
    }
  }

  if (profile.projects.length) {
    out.push('', 'PROJECTS');
    for (const p of profile.projects) {
      out.push(`${p.name}${p.description ? ` — ${p.description}` : ''}`);
      for (const h of p.highlights) out.push(`• ${h}`);
    }
  }

  if (profile.education.length) {
    out.push('', 'EDUCATION');
    for (const e of profile.education) {
      out.push(
        [
          `${e.degree}${e.field ? `, ${e.field}` : ''}`,
          e.institution,
          [e.startDate, e.endDate].filter(Boolean).join(' - '),
        ]
          .filter(Boolean)
          .join(' — '),
      );
    }
  }

  if (profile.certifications.length) {
    out.push('', 'CERTIFICATIONS');
    for (const cert of profile.certifications) {
      out.push(`${cert.name}${cert.issuer ? ` — ${cert.issuer}` : ''}`);
    }
  }

  if (profile.languages.length) out.push('', 'LANGUAGES', profile.languages.join(', '));

  return out.join('\n');
}
