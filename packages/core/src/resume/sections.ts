import { looksLikeHeading } from "./lines.ts";

export type SectionKey =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "languages"
  | "other";

const SECTION_KEYWORDS: Array<{
  key: SectionKey;
  keywords: RegExp;
  negative?: RegExp;
}> = [
  {
    key: "experience",
    keywords:
      /\b(experience|employment|work history|career|professional background|positions? held|where i'?ve worked|what i'?ve done|roles?)\b/i,

    negative: /\b(volunteer|project|education|academic)\b/i,
  },
  {
    key: "education",

    keywords:
      /\b(education\w*|academic\w*|schooling|university|degrees?|qualification\w*|studies)\b/i,
  },
  {
    key: "skills",
    keywords:
      /\b(skills?|competenc\w*|technolog\w*|tech stack|expertise|proficienc\w*|toolkit|tools?|what i know|capabilities|stack)\b/i,
  },
  {
    key: "projects",
    keywords: /\b(projects?|portfolio|selected work|open source|side work)\b/i,
  },
  {
    key: "certifications",
    keywords:
      /\b(certificat\w*|certified|licens\w*|credential\w*|awards?|honou?rs?|achievements?|accreditation\w*)\b/i,
  },
  {
    key: "languages",
    keywords: /\b(languages? spoken|spoken languages?|languages?)\b/i,
  },
  {
    key: "summary",
    keywords:
      /\b(summary|profile|objective|about|overview|introduction|professional statement|what i do|who i am)\b/i,
  },
];

export function headingFor(line: string): SectionKey | null {
  const cleaned = line
    .replace(/[:：]\s*$/, "")
    .replace(/^[*#>\s]+/, "")
    .replace(/[_=~–—-]{2,}/g, "")
    .trim();

  if (cleaned.length < 2 || cleaned.length > 60) return null;

  const wordCount = cleaned.split(/\s+/).length;
  if (wordCount > 7) return null;

  for (const section of SECTION_KEYWORDS) {
    if (section.negative?.test(cleaned)) continue;
    if (section.keywords.test(cleaned)) {
      if (section.key === "languages" && /[,;]/.test(line)) return null;
      return section.key;
    }
  }

  return looksLikeHeading(cleaned) ? "other" : null;
}

export type Sections = Record<SectionKey, string[]>;

export function emptySections(): Sections {
  return {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    languages: [],
    other: [],
  };
}

export function splitIntoSections(lines: string[]): {
  sections: Sections;
  firstHeadingIndex: number;
} {
  const sections = emptySections();
  let active: SectionKey = "other";
  let firstHeadingIndex = -1;

  lines.forEach((line, index) => {
    const heading = headingFor(line.trim());
    if (heading) {
      active = heading;
      if (firstHeadingIndex === -1) firstHeadingIndex = index;
      return;
    }
    sections[active].push(line);
  });

  return { sections, firstHeadingIndex };
}
