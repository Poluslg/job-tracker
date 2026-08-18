import type {
  EducationAlignment,
  ExperienceAlignment,
  JobRequirement,
  ResumeProfile,
} from "@job-ai/types";
import { requiredYears } from "../extraction/requirements.ts";
import { clamp, lower, round } from "../util/text.ts";

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function parseResumeDate(input: string): Date | null {
  const s = lower(input);
  if (!s) return null;
  if (/^(present|current|now|ongoing)$/.test(s)) return new Date();

  const monthYear = s.match(/([a-z]{3})[a-z]*\.?\s+(\d{4})/);
  if (monthYear?.[1] && monthYear[2]) {
    const m = MONTHS[monthYear[1]];
    if (m !== undefined) return new Date(Number(monthYear[2]), m, 1);
  }
  const numeric = s.match(/(\d{1,2})[/-](\d{4})/);
  if (numeric?.[1] && numeric[2])
    return new Date(Number(numeric[2]), Number(numeric[1]) - 1, 1);
  const isoish = s.match(/(\d{4})[-/](\d{1,2})/);
  if (isoish?.[1] && isoish[2])
    return new Date(Number(isoish[1]), Number(isoish[2]) - 1, 1);
  const yearOnly = s.match(/\b(19|20)\d{2}\b/);
  if (yearOnly) return new Date(Number(yearOnly[0]), 0, 1);
  return null;
}

export function totalExperienceYears(profile: ResumeProfile): number | null {
  const ranges: Array<[number, number]> = [];
  for (const e of profile.experience) {
    const start = parseResumeDate(e.startDate);
    if (!start) continue;
    const end = e.current
      ? new Date()
      : (parseResumeDate(e.endDate) ?? new Date());
    if (end.getTime() < start.getTime()) continue;
    ranges.push([start.getTime(), end.getTime()]);
  }
  if (ranges.length === 0) return null;

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  const ms = merged.reduce((sum, [a, b]) => sum + (b - a), 0);
  return round(ms / (365.25 * 24 * 3600 * 1000), 1);
}

export function analyzeExperience(
  profile: ResumeProfile,
  requirements: JobRequirement[],
): { alignment: ExperienceAlignment; score: number } {
  const resumeYears = totalExperienceYears(profile);
  const required = requiredYears(requirements);
  const relevantTitles = profile.experience.map((e) => e.title).filter(Boolean);

  if (required === null) {
    const verdict = resumeYears === null ? "unknown" : "meets";
    return {
      alignment: {
        resumeYears,
        requiredYears: null,
        verdict,
        note:
          resumeYears === null
            ? "The posting does not state a years-of-experience requirement, and we could not determine your total experience from your resume dates."
            : `The posting does not state a years-of-experience requirement. Your resume shows about ${resumeYears} years.`,
        relevantTitles,
      },
      score: resumeYears === null ? 50 : 80,
    };
  }

  if (resumeYears === null) {
    return {
      alignment: {
        resumeYears: null,
        requiredYears: required,
        verdict: "unknown",
        note: `This role asks for ${required}+ years. We could not read employment dates from your resume — add or correct them for a more accurate score.`,
        relevantTitles,
      },
      score: 40,
    };
  }

  const ratio = resumeYears / required;
  const verdict =
    ratio >= 1.25
      ? "above"
      : ratio >= 1
        ? "meets"
        : ratio >= 0.75
          ? "near"
          : "below";
  const score = clamp(Math.round(Math.min(ratio, 1.15) * 100));

  const note =
    verdict === "above"
      ? `You have about ${resumeYears} years against the ${required}+ requested — comfortably above.`
      : verdict === "meets"
        ? `You have about ${resumeYears} years, meeting the ${required}+ requested.`
        : verdict === "near"
          ? `You have about ${resumeYears} years against ${required}+ requested. Stated ranges are often flexible; lead with relevant depth.`
          : `You have about ${resumeYears} years against ${required}+ requested. This is a real gap — emphasise scope and impact rather than tenure.`;

  return {
    alignment: {
      resumeYears,
      requiredYears: required,
      verdict,
      note,
      relevantTitles,
    },
    score,
  };
}

const DEGREE_LEVELS: Array<{ level: number; patterns: RegExp }> = [
  { level: 4, patterns: /\b(ph\.?d|doctorate|doctoral)\b/i },
  { level: 3, patterns: /\b(m\.?s\.?c?|master'?s?|m\.?eng|mba|m\.?tech)\b/i },
  {
    level: 2,
    patterns: /\b(b\.?s\.?c?|bachelor'?s?|b\.?eng|b\.?tech|b\.?a\b)\b/i,
  },
  { level: 1, patterns: /\b(associate'?s?|diploma|a\.?a\.?s)\b/i },
];

function degreeLevel(text: string): number {
  for (const d of DEGREE_LEVELS) if (d.patterns.test(text)) return d.level;
  return 0;
}

export function analyzeEducation(
  profile: ResumeProfile,
  jobDescription: string,
): { alignment: EducationAlignment; score: number } {
  const jobLevel = degreeLevel(jobDescription);
  const equivalentAccepted =
    /\b(or equivalent|equivalent (practical )?experience|or relevant experience)\b/i.test(
      jobDescription,
    );
  const resumeLevel = Math.max(
    0,
    ...profile.education.map((e) => degreeLevel(`${e.degree} ${e.field}`)),
  );
  const credentials = [
    ...profile.education
      .filter((e) => e.degree)
      .map((e) => `${e.degree}${e.field ? `, ${e.field}` : ""}`),
    ...profile.certifications.filter((c) => c.name).map((c) => c.name),
  ];

  if (jobLevel === 0) {
    return {
      alignment: {
        verdict: "not-specified",
        note: "The posting does not state a specific degree requirement.",
        matchedCredentials: credentials,
      },
      score: 75,
    };
  }
  if (resumeLevel >= jobLevel) {
    return {
      alignment: {
        verdict: "meets",
        note: "Your education meets or exceeds the level stated in the posting.",
        matchedCredentials: credentials,
      },
      score: 100,
    };
  }
  if (equivalentAccepted) {
    return {
      alignment: {
        verdict: "partial",
        note: "The posting accepts equivalent experience in place of the stated degree. Make sure your experience section carries that weight.",
        matchedCredentials: credentials,
      },
      score: 70,
    };
  }
  return {
    alignment: {
      verdict: resumeLevel > 0 ? "partial" : "below",
      note: "The posting states a degree level above what your resume lists. Many employers still consider strong practical experience — do not add credentials you do not hold.",
      matchedCredentials: credentials,
    },
    score: resumeLevel > 0 ? 55 : 30,
  };
}
