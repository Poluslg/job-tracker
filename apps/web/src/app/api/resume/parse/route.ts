import { ParseResumeRequest, nowIso } from '@job-ai/types';
import {
  AIResumeParse,
  createProvider,
  isConfigured,
  resumeParsePrompt,
  runPrompt,
} from '@job-ai/ai';
import { createId, parseResumeText } from '@job-ai/core';
import { loadUserData, mutateUserData } from '@/server/data';
import { ok, readJson, route } from '@/server/http';

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeContact(
  contact: Partial<AIResumeParse['contact']> | undefined,
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

function normalizeProfile(ai: AIResumeParse) {
  return {
    contact: normalizeContact(ai.contact),

    summary: cleanString(ai.summary),

    skills: cleanStringArray(ai.skills).map((name) => ({
      name,
      category: 'technical' as const,
      years: null,
    })),

    experience: Array.isArray(ai.experience)
      ? ai.experience
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            id: createId('exp'),
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
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            id: createId('edu'),
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
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            id: createId('cert'),
            name: cleanString(item.name),
            issuer: cleanString(item.issuer),
            issued: cleanString(item.date),
            expires: '',
            credentialId: cleanString(item.url),
          }))
          .filter((item) => item.name)
      : [],

    projects: Array.isArray(ai.projects)
      ? ai.projects
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            id: createId('proj'),
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

function hasUsefulProfile(profile: ReturnType<typeof normalizeProfile>) {
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

export async function POST(request: Request) {
  return route(async () => {
    const parsed = await readJson(request, ParseResumeRequest);

    if (!parsed.ok) {
      return parsed.response;
    }

    const body = parsed.data;

    const { data } = await loadUserData();
    const settings = data.settings;

    const aiConfig = settings.demoMode
      ? {
          ...settings.ai,
          provider: 'mock' as const,
        }
      : settings.ai;

    const aiConfigured =
      settings.demoMode || isConfigured(aiConfig);

    const aiEnabled = body.useAI && aiConfigured;

    const fallbackProfile = parseResumeText(body.text);

    let finalProfile = fallbackProfile;
    let usedAI = false;


    if (aiEnabled) {

      try {

        const provider = createProvider(aiConfig);


        

        const result = await runPrompt(
          provider,
          resumeParsePrompt,
          AIResumeParse,
          {
            resumeText: body.text.slice(0, 80_000),
            draftSummary: '',
          },
        );



        const aiProfile = normalizeProfile(result.data);


        if (hasUsefulProfile(aiProfile)) {
          finalProfile = aiProfile;
          usedAI = true;

        } else {
          console.error(
            '[Resume AI] AI returned insufficient data',
          );
        }
      } catch (error) {
        console.error(
          '[Resume AI Parse Error]',
          error,
        );

        if (error instanceof Error) {
          console.error(
            '[Resume AI Error Message]',
            error.message,
          );

          console.error(
            '[Resume AI Error Stack]',
            error.stack,
          );
        }
      }
    }

    const now = nowIso();

    const resume = {
      id: createId('res'),
      label:
        body.fileName.replace(/\.[^.]+$/, '') ||
        'My Resume',
      origin: {
        fileName: body.fileName,
        fileType: body.fileType,
        fileSize: body.text.length,
        uploadedAt: now,
        rawText: body.text,
      },
      parsed: finalProfile,
      profile: finalProfile,
      needsReview: !usedAI,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    };

    await mutateUserData((d) => {
      d.resumes = [resume];
      d.resumeVersions = [];
    });

    return ok(
      {
        resume,
        usedAI,
      },
      201,
    );
  });
}