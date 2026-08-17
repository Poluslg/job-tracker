import type { JobRequirement, MatchQuality } from "@job-ai/types";
import type { ResumeSkillIndex } from "./skills.ts";
import { clamp, containsTerm, lower, tokenize } from "../util/text.ts";

export function analyzeResponsibilities(
  index: ResumeSkillIndex,
  requirements: JobRequirement[],
): {
  score: number;
  covered: string[];
  uncovered: string[];
  coverage: Record<string, MatchQuality>;
} {
  const resps = requirements.filter((r) => r.kind === "responsibility");
  const coverage: Record<string, MatchQuality> = {};
  const covered: string[] = [];
  const uncovered: string[] = [];

  if (resps.length === 0) {
    return { score: 60, covered, uncovered, coverage };
  }

  const resumeLower = lower(index.text);

  for (const r of resps) {
    const skillHits = r.skills.filter((s) => index.skills.has(s)).length;
    const terms = tokenize(r.text).filter((t) => t.length > 3);
    const termHits = terms.filter((t) => containsTerm(resumeLower, t)).length;
    const termRatio = terms.length ? termHits / terms.length : 0;

    const strength = clamp(skillHits * 40 + termRatio * 60, 0, 100);
    const quality: MatchQuality =
      strength >= 60 ? "strong" : strength >= 30 ? "partial" : "missing";
    coverage[r.id] = quality;
    if (quality === "missing") uncovered.push(r.text);
    else covered.push(r.text);
  }

  const earned = Object.values(coverage).reduce(
    (sum, q) => sum + (q === "strong" ? 1 : q === "partial" ? 0.5 : 0),
    0,
  );
  return {
    score: clamp(Math.round((earned / resps.length) * 100)),
    covered,
    uncovered,
    coverage,
  };
}

const DOMAINS: Record<string, string[]> = {
  Fintech: [
    "fintech",
    "payments",
    "banking",
    "trading",
    "ledger",
    "kyc",
    "compliance",
    "lending",
  ],
  Healthcare: [
    "healthcare",
    "clinical",
    "patient",
    "hipaa",
    "ehr",
    "medical",
    "telehealth",
  ],
  "E-commerce": [
    "e-commerce",
    "ecommerce",
    "checkout",
    "marketplace",
    "catalog",
    "fulfillment",
    "retail",
  ],
  "Developer Tools": [
    "developer tools",
    "sdk",
    "cli",
    "api platform",
    "devtools",
    "open source",
  ],
  Gaming: ["gaming", "game", "unity", "unreal", "multiplayer"],
  Education: ["education", "edtech", "learning", "curriculum", "students"],
  Security: [
    "security",
    "threat",
    "vulnerability",
    "soc",
    "siem",
    "penetration",
  ],
  "AI/ML": [
    "llm",
    "generative ai",
    "machine learning",
    "model training",
    "inference",
    "embeddings",
  ],
  Logistics: ["logistics", "supply chain", "shipping", "warehouse", "fleet"],
  Media: ["media", "streaming", "content", "publishing", "video"],
  SaaS: ["saas", "b2b", "subscription", "multi-tenant", "enterprise software"],
};

function domainsIn(text: string): string[] {
  const hay = lower(text);
  return Object.entries(DOMAINS)
    .filter(([, terms]) => terms.some((t) => containsTerm(hay, t)))
    .map(([name]) => name);
}

export function analyzeDomain(
  resumeText: string,
  jobDescription: string,
): { score: number; shared: string[]; jobDomains: string[]; note: string } {
  const jobDomains = domainsIn(jobDescription);
  const resumeDomains = domainsIn(resumeText);
  const shared = jobDomains.filter((d) => resumeDomains.includes(d));

  if (jobDomains.length === 0) {
    return {
      score: 70,
      shared,
      jobDomains,
      note: "No specific industry signals detected in the posting, so domain fit is treated as neutral.",
    };
  }
  const ratio = shared.length / jobDomains.length;
  const note = shared.length
    ? `Shared industry context: ${shared.join(", ")}.`
    : `The posting signals ${jobDomains.join(", ")}, which your resume does not currently reflect. Transferable work is still worth calling out explicitly.`;
  return {
    score: clamp(Math.round(30 + ratio * 70)),
    shared,
    jobDomains,
    note,
  };
}
