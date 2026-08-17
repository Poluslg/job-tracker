import { createId } from "../util/id.ts";
import type { AIResumeParse } from "@job-ai/ai";

export function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeContact(
  contact: Partial<AIResumeParse["contact"]> | undefined,
) {
  return {
    name: cleanString(contact?.name),
    email: cleanString(contact?.email),
    phone: cleanString(contact?.phone),
    location: cleanString(contact?.location),
    linkedin: cleanString(contact?.linkedin),
    github: cleanString(contact?.github),
    portfolio: cleanString(contact?.portfolio),
  };
}

export function normalizeProfile(ai: AIResumeParse) {
  return {
    contact: normalizeContact(ai.contact),

    summary: cleanString(ai.summary),

    skills: cleanStringArray(ai.skills).map((name) => ({
      name,
      category: "technical" as const,
      years: null,
    })),

    experience: Array.isArray(ai.experience)
      ? ai.experience
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: createId("exp"),
            title: cleanString(item.title),
            company: cleanString(item.company),
            location: cleanString(item.location),
            startDate: cleanString(item.startDate),
            endDate: cleanString(item.endDate),
            current: Boolean(item.current),
            responsibilities: cleanStringArray(item.responsibilities),
            achievements: cleanStringArray(item.achievements),
            technologies: cleanStringArray(item.technologies),
          }))
          .filter((item) => item.title || item.company)
      : [],

    education: Array.isArray(ai.education)
      ? ai.education
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: createId("edu"),
            degree: cleanString(item.degree),
            field: cleanString(item.field),
            institution: cleanString(item.institution),
            location: cleanString(item.location),
            startDate: cleanString(item.startDate),
            endDate: cleanString(item.endDate),
            gpa: cleanString(item.gpa),
            highlights: cleanStringArray(item.highlights),
          }))
          .filter((item) => item.degree || item.institution)
      : [],

    certifications: Array.isArray(ai.certifications)
      ? ai.certifications
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: createId("cert"),
            name: cleanString(item.name),
            issuer: cleanString(item.issuer),
            issued: cleanString(item.date),
            expires: "",
            credentialId: cleanString(item.url),
          }))
          .filter((item) => item.name)
      : [],

    projects: Array.isArray(ai.projects)
      ? ai.projects
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: createId("proj"),
            name: cleanString(item.name),
            description: cleanString(item.description),
            url: cleanString(item.url),
            technologies: cleanStringArray(item.technologies),
            highlights: cleanStringArray(item.highlights),
          }))
          .filter((item) => item.name)
      : [],

    languages: cleanStringArray(ai.languages),
  };
}

export function hasUsefulProfile(profile: ReturnType<typeof normalizeProfile>) {
  return Boolean(
    profile.contact.name ||
    profile.contact.email ||
    profile.summary ||
    profile.skills.length ||
    profile.experience.length ||
    profile.education.length ||
    profile.projects.length,
  );
}
