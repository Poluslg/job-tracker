import type { WorkExperience } from "@job-ai/types";
import { createId } from "../util/id.ts";
import { canonicalizeSkill, detectSkills } from "../skills/taxonomy.ts";
import {
  DATE_RANGE_RE,
  classifyHeaderSegments,
  extractDateRange,
  isBulletLine,
  looksLikeCompany,
  looksLikeHeading,
  looksLikeTitle,
  splitSegments,
  stripBulletMarker,
} from "./lines.ts";

const isKnownSkill = (term: string): boolean =>
  canonicalizeSkill(term) !== null;

const ACHIEVEMENT_RE =
  /\d+\s*(%|percent|x\b|k\b|m\b|bn?\b|ms\b|users|customers|requests|hours|weeks|days)|\b(reduced|increased|improved|cut|grew|saved|led|launched|shipped|scaled|optimized|optimised|drove|delivered|generated|eliminated|accelerated)\b/i;

function newRole(): WorkExperience {
  return {
    id: createId("exp"),
    title: "",
    company: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    responsibilities: [],
    achievements: [],
    technologies: [],
  };
}

function couldBeHeaderLine(line: string): boolean {
  const s = line.trim();
  if (!s || s.length > 130) return false;
  if (isBulletLine(s)) return false;
  if (/[@]|https?:\/\//.test(s)) return false;
  if (/[.!?]$/.test(s) && s.split(/\s+/).length > 8) return false;
  return true;
}

export function parseExperience(lines: string[]): WorkExperience[] {
  const roles: WorkExperience[] = [];
  let current: WorkExperience | null = null;

  const flush = () => {
    if (current && (current.title || current.company)) roles.push(current);
    current = null;
  };

  const addBullet = (role: WorkExperience, text: string) => {
    if (!text) return;
    if (ACHIEVEMENT_RE.test(text)) role.achievements.push(text);
    else role.responsibilities.push(text);
    role.technologies = [
      ...new Set([...role.technologies, ...detectSkills(text)]),
    ];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (!line) continue;

    if (isBulletLine(line)) {
      if (!current) continue;
      addBullet(current, stripBulletMarker(line));
      continue;
    }

    if (looksLikeHeading(line) && !DATE_RANGE_RE.test(line)) {
      flush();
      continue;
    }

    if (!couldBeHeaderLine(line)) {
      if (current && line.length > 20) addBullet(current, line);
      continue;
    }

    const dates = extractDateRange(line);

    if (dates.found && DATE_RANGE_RE.test(line)) {
      const parts = classifyHeaderSegments(
        splitSegments(dates.rest),
        isKnownSkill,
      );

      if (current && !current.startDate && (current.title || current.company)) {
        current.startDate = dates.start;
        current.endDate = dates.end;
        current.current = dates.current;
        if (parts.location && !current.location)
          current.location = parts.location;

        for (const candidate of [parts.title, parts.company].filter(Boolean)) {
          if (!current.company && candidate !== current.title)
            current.company = candidate;
          else if (!current.title && candidate !== current.company)
            current.title = candidate;
        }

        if (
          current.title &&
          current.company &&
          looksLikeTitle(current.company) &&
          !looksLikeTitle(current.title)
        ) {
          [current.title, current.company] = [current.company, current.title];
        }
        continue;
      }

      flush();
      current = newRole();
      current.title = parts.title;
      current.company = parts.company;
      current.location = parts.location;
      current.startDate = dates.start;
      current.endDate = dates.end;
      current.current = dates.current;
      continue;
    }

    const segments = splitSegments(line);
    const parts = classifyHeaderSegments(segments, isKnownSkill);
    const hasSignal =
      Boolean(parts.title || parts.company) &&
      (looksLikeTitle(line) || looksLikeCompany(line) || segments.length > 1);

    const next = (lines[i + 1] ?? "").trim();
    const afterNext = (lines[i + 2] ?? "").trim();
    const dateIsNear =
      DATE_RANGE_RE.test(next) || DATE_RANGE_RE.test(afterNext);

    if (hasSignal && (dateIsNear || segments.length > 1)) {
      if (
        current &&
        !current.startDate &&
        (current.title || current.company) &&
        !DATE_RANGE_RE.test(next)
      ) {
        if (!current.company && parts.company) current.company = parts.company;
        else if (!current.title && parts.title) current.title = parts.title;
        else if (
          !current.company &&
          parts.title &&
          parts.title !== current.title
        )
          current.company = parts.title;
        if (!current.location && parts.location)
          current.location = parts.location;
        continue;
      }

      flush();
      current = newRole();
      current.title = parts.title;
      current.company = parts.company;
      current.location = parts.location;
      continue;
    }

    if (current && line.length > 20) addBullet(current, line);
  }

  flush();
  return roles.filter((r) => r.title || r.company);
}

export function parseExperienceAnywhere(lines: string[]): WorkExperience[] {
  const candidates: string[] = [];
  let capturing = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      candidates.push("");
      continue;
    }

    const isEducationish =
      /\b(university|college|institute|b\.?s\.?c?\b|m\.?s\.?c?\b|bachelor|master|ph\.?d|degree|gpa)\b/i.test(
        line,
      );

    if (
      DATE_RANGE_RE.test(line) &&
      couldBeHeaderLine(line) &&
      !isEducationish
    ) {
      capturing = true;
      candidates.push(line);
      continue;
    }
    if (capturing) candidates.push(line);
  }

  return parseExperience(candidates);
}
