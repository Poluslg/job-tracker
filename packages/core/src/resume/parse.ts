import type { Education, ResumeProfile, ResumeSkill, WorkExperience } from '@job-ai/types';
import { ResumeProfile as ResumeProfileSchema } from '@job-ai/types';
import { canonicalizeSkill, detectSkills, getSkillEntry } from '../skills/taxonomy.ts';
import { createId } from '../util/id.ts';
import { normalize } from '../util/text.ts';

type SectionKey =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'languages'
  | 'other';

const SECTION_HEADINGS: Array<{ key: SectionKey; re: RegExp }> = [
  { key: 'summary', re: /^(professional\s+)?(summary|profile|objective|about( me)?|overview)$/i },
  { key: 'experience', re: /^(work\s+)?(experience|employment( history)?|professional experience|career history|work history)$/i },
  { key: 'education', re: /^(education|academic background|academics|qualifications)$/i },
  { key: 'skills', re: /^(technical\s+)?(skills|core competencies|technologies|tech stack|expertise|competencies)$/i },
  { key: 'projects', re: /^(projects?|personal projects|side projects|selected projects)$/i },
  { key: 'certifications', re: /^(certifications?|licenses?|certificates?|awards?)$/i },
  { key: 'languages', re: /^(languages?)$/i },
];

const CONTACT_PATTERNS = {
  email: /[\w.+-]+@[\w-]+\.[\w.]{2,}/,
  phone: /(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/,
  linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i,
  github: /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i,
  url: /(?:https?:\/\/)[\w.-]+\.[a-z]{2,}(?:\/\S*)?/i,
};

function headingFor(line: string): SectionKey | null {
  const cleaned = line.replace(/[:：]\s*$/, '').replace(/^[^a-z]*/i, '').trim();
  if (cleaned.length > 40 || cleaned.length < 3) return null;
  for (const h of SECTION_HEADINGS) if (h.re.test(cleaned)) return h.key;
  return null;
}

const DATE_RANGE =
  /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{1,2}\/\d{4}|\d{4})\s*(?:-|–|—|to)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{1,2}\/\d{4}|\d{4}|present|current|now)/i;

function isBullet(line: string): boolean {
  return /^\s*[•·▪◦*\-–—]\s+/.test(line);
}

function stripBullet(line: string): string {
  return line.replace(/^\s*[•·▪◦*\-–—]\s+/, '').trim();
}

function splitList(text: string): string[] {
  return text
    .split(/[,;|•·]|\s{3,}/)
    .map((s) => s.replace(/^\s*[-–—]\s*/, '').trim())
    .filter((s) => s.length > 1 && s.length < 60);
}

function parseContact(lines: string[]): ResumeProfile['contact'] {
  const head = lines.slice(0, 12).join('\n');
  const all = lines.join('\n');

  const email = head.match(CONTACT_PATTERNS.email)?.[0] ?? all.match(CONTACT_PATTERNS.email)?.[0] ?? '';
  const linkedin = all.match(CONTACT_PATTERNS.linkedin)?.[0] ?? '';
  const github = all.match(CONTACT_PATTERNS.github)?.[0] ?? '';

  const phoneMatch = head.match(CONTACT_PATTERNS.phone)?.[0] ?? '';
  const phone = phoneMatch.replace(/\D/g, '').length >= 9 ? phoneMatch.trim() : '';

  let name = '';
  for (const raw of lines.slice(0, 6)) {
    const line = raw.trim();
    if (!line || line.length > 60) continue;
    if (CONTACT_PATTERNS.email.test(line) || CONTACT_PATTERNS.url.test(line)) continue;
    if (/\d/.test(line)) continue;
    if (headingFor(line)) continue;
    const words = line.split(/\s+/);
    if (words.length >= 1 && words.length <= 5) {
      name = line.replace(/\s{2,}/g, ' ');
      break;
    }
  }

  const locMatch = head.match(/^[^\n]*?([A-Z][a-zA-Z.'-]+(?:\s[A-Z][a-zA-Z.'-]+)*,\s*[A-Z][a-zA-Z.]{1,20})/m);
  const location = locMatch?.[1]?.trim() ?? '';

  const portfolio =
    [...head.matchAll(new RegExp(CONTACT_PATTERNS.url, 'gi'))]
      .map((m) => m[0])
      .find((u) => !/linkedin|github/i.test(u)) ?? '';

  return { name, email, phone, location, linkedin, github, portfolio };
}

function parseExperience(lines: string[]): WorkExperience[] {
  const roles: WorkExperience[] = [];
  let current: WorkExperience | null = null;

  const flush = () => {
    if (current && (current.title || current.company)) roles.push(current);
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (isBullet(line)) {
      if (!current) continue;
      const text = stripBullet(line);
      
      const achievement = /\d+\s*(%|percent|x\b|k\b|m\b|ms\b)|\b(reduced|increased|improved|cut|grew|saved|led|launched|shipped)\b/i.test(
        text,
      );
      if (achievement) current.achievements.push(text);
      else current.responsibilities.push(text);
      current.technologies = [...new Set([...current.technologies, ...detectSkills(text)])];
      continue;
    }

    const dates = line.match(DATE_RANGE);
    const looksLikeHeader = dates !== null || /\s(?:—|–|-|\||@|at)\s/.test(line);
    if (!looksLikeHeader || line.length > 160) {
      
      if (current && line.length > 30) current.responsibilities.push(line);
      continue;
    }

    flush();

    let rest = line;
    let startDate = '';
    let endDate = '';
    let isCurrent = false;
    if (dates) {
      startDate = dates[1]?.trim() ?? '';
      const end = dates[2]?.trim() ?? '';
      isCurrent = /present|current|now/i.test(end);
      endDate = isCurrent ? '' : end;
      rest = line.replace(dates[0], '').trim();
    }

    const parts = rest
      .split(/\s*(?:—|–|\||@|\bat\b)\s*|\s{3,}/)
      .map((p) => p.replace(/^[-–—,\s]+|[-–—,\s]+$/g, '').trim())
      .filter(Boolean);

    current = {
      id: createId('exp'),
      title: parts[0] ?? '',
      company: parts[1] ?? '',
      location: parts[2] ?? '',
      startDate,
      endDate,
      current: isCurrent,
      responsibilities: [],
      achievements: [],
      technologies: [],
    };
  }
  flush();
  return roles;
}

function parseEducation(lines: string[]): Education[] {
  const out: Education[] = [];
  let current: Education | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (isBullet(line)) {
      current?.highlights.push(stripBullet(line));
      continue;
    }

    const hasDegree = /\b(b\.?s\.?c?|bachelor|m\.?s\.?c?|master|ph\.?d|doctorate|associate|diploma|b\.?tech|m\.?tech|mba|b\.?eng|m\.?eng)\b/i.test(
      line,
    );
    const dates = line.match(DATE_RANGE) ?? line.match(/\b(19|20)\d{2}\b/);

    if (hasDegree || (dates && !current)) {
      if (current) out.push(current);
      const gpa = line.match(/\bgpa[:\s]*([\d.]+(?:\s*\/\s*[\d.]+)?)/i)?.[1] ?? '';
      const degreeMatch = line.match(
        /\b((?:b\.?s\.?c?|bachelor(?:'s)?|m\.?s\.?c?|master(?:'s)?|ph\.?d|doctorate|associate(?:'s)?|diploma|b\.?tech|m\.?tech|mba|b\.?eng|m\.?eng)[^,|—–]*)/i,
      );
      const field = line.match(/\b(?:in|of)\s+([A-Z][\w\s&]{2,40})/)?.[1]?.trim() ?? '';
      const institution =
        line
          .split(/[,|—–]/)
          .map((p) => p.trim())
          .find((p) => /\b(university|college|institute|school|academy|polytechnic)\b/i.test(p)) ?? '';

      current = {
        id: createId('edu'),
        degree: degreeMatch?.[1]?.trim() ?? '',
        field,
        institution,
        location: '',
        startDate: dates?.[1] ?? '',
        endDate: dates?.[2] ?? (dates?.[0] && !dates[2] ? dates[0] : ''),
        gpa,
        highlights: [],
      };
    } else if (current && !current.institution && /\b(university|college|institute|school)\b/i.test(line)) {
      current.institution = line;
    }
  }
  if (current) out.push(current);
  return out;
}

function parseSkills(sectionText: string, fullText: string): ResumeSkill[] {
  const named = new Set<string>();
  for (const line of sectionText.split(/\r?\n/)) {
    
    const body = line.includes(':') ? line.slice(line.indexOf(':') + 1) : line;
    for (const item of splitList(stripBullet(body))) named.add(item);
  }
  
  for (const s of detectSkills(sectionText || fullText)) named.add(s);

  const seen = new Set<string>();
  const out: ResumeSkill[] = [];
  for (const raw of named) {
    const canonical = canonicalizeSkill(raw) ?? normalize(raw);
    const key = canonical.toLowerCase();
    if (!canonical || seen.has(key) || canonical.length > 40) continue;
    seen.add(key);
    out.push({
      name: canonical,
      category: getSkillEntry(canonical)?.category ?? 'technical',
      years: null,
    });
  }
  return out;
}

export function parseResumeText(rawText: string): ResumeProfile {
  const text = rawText.replace(/\r\n/g, '\n').replace(/ /g, ' ');
  const lines = text.split('\n');

  const sections: Record<SectionKey, string[]> = {
    summary: [], experience: [], education: [], skills: [],
    projects: [], certifications: [], languages: [], other: [],
  };

  let active: SectionKey = 'other';
  for (const line of lines) {
    const heading = headingFor(line.trim());
    if (heading) {
      active = heading;
      continue;
    }
    sections[active].push(line);
  }

  const contact = parseContact(lines);

  const summary =
    sections.summary
      .map((l) => stripBullet(l).trim())
      .filter(Boolean)
      .join(' ')
      .slice(0, 1200) || '';

  const projects = sections.projects
    .filter((l) => l.trim().length > 10)
    .reduce<ResumeProfile['projects']>((acc, line) => {
      const t = stripBullet(line).trim();
      if (isBullet(line) && acc.length) {
        acc[acc.length - 1]!.highlights.push(t);
        return acc;
      }
      const [namePart, ...descParts] = t.split(/\s*[—–:|]\s*/);
      acc.push({
        id: createId('proj'),
        name: (namePart ?? '').slice(0, 80),
        description: descParts.join(' — '),
        url: t.match(CONTACT_PATTERNS.url)?.[0] ?? '',
        technologies: detectSkills(t),
        highlights: [],
      });
      return acc;
    }, []);

  const certifications = sections.certifications
    .map((l) => stripBullet(l).trim())
    .filter((l) => l.length > 3)
    .map((l) => {
      const [name, issuer] = l.split(/\s*[—–|,]\s*/);
      return {
        id: createId('cert'),
        name: (name ?? '').slice(0, 120),
        issuer: (issuer ?? '').slice(0, 120),
        issued: l.match(/\b(19|20)\d{2}\b/)?.[0] ?? '',
        expires: '',
        credentialId: '',
      };
    });

  const languages = sections.languages.flatMap((l) => splitList(stripBullet(l)));

  const profile: ResumeProfile = {
    contact,
    summary,
    skills: parseSkills(sections.skills.join('\n'), text),
    experience: parseExperience(sections.experience),
    education: parseEducation(sections.education),
    certifications,
    projects,
    languages: [...new Set(languages)],
  };

  return ResumeProfileSchema.parse(profile);
}

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
      const dates = e.current ? `${e.startDate} - Present` : [e.startDate, e.endDate].filter(Boolean).join(' - ');
      out.push([e.title, e.company, e.location].filter(Boolean).join(' — ') + (dates ? ` | ${dates}` : ''));
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
        [`${e.degree}${e.field ? `, ${e.field}` : ''}`, e.institution, [e.startDate, e.endDate].filter(Boolean).join(' - ')]
          .filter(Boolean)
          .join(' — '),
      );
    }
  }

  if (profile.certifications.length) {
    out.push('', 'CERTIFICATIONS');
    for (const c2 of profile.certifications) out.push(`${c2.name}${c2.issuer ? ` — ${c2.issuer}` : ''}`);
  }

  if (profile.languages.length) out.push('', 'LANGUAGES', profile.languages.join(', '));

  return out.join('\n');
}
