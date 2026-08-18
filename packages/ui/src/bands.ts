import type { ApplicationStatus } from "@job-ai/types";

export type ScoreTone = "strong" | "good" | "warn" | "danger";

export function bandFor(score: number): { label: string; tone: ScoreTone } {
  if (score >= 80) return { label: "Strong match", tone: "strong" };
  if (score >= 65) return { label: "Good match", tone: "good" };
  if (score >= 45) return { label: "Partial match", tone: "warn" };
  return { label: "Limited match", tone: "danger" };
}

export const SCORE_DISCLAIMER =
  "An analytical estimate of how your resume aligns with this posting. It is not a prediction of whether you will be contacted, interviewed or hired.";

export const STATUS_TONE: Record<
  ApplicationStatus,
  "neutral" | "brand" | "strong" | "good" | "warn" | "danger"
> = {
  saved: "neutral",
  preparing: "neutral",
  applied: "brand",
  "recruiter-screen": "good",
  interview: "good",
  "technical-round": "good",
  "final-round": "warn",
  offer: "strong",
  rejected: "danger",
  withdrawn: "neutral",
};
