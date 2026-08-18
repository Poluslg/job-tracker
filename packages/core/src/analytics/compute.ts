import type {
  AnalyticsResponse,
  Application,
  ApplicationStatus,
  JobAnalysis,
} from "@job-ai/types";
import { FUNNEL_STAGES, STATUS_LABELS } from "@job-ai/types";
import { round } from "../util/text.ts";

const ADVANCED: ApplicationStatus[] = [
  "recruiter-screen",
  "interview",
  "technical-round",
  "final-round",
  "offer",
];

const STAGE_ORDER: ApplicationStatus[] = [
  "saved",
  "preparing",
  "applied",
  "recruiter-screen",
  "interview",
  "technical-round",
  "final-round",
  "offer",
];

function furthestStageIndex(app: Application): number {
  const seen = [
    app.status,
    ...app.timeline
      .map((e) => e.to)
      .filter((s): s is ApplicationStatus => s !== null),
  ];
  return Math.max(-1, ...seen.map((s) => STAGE_ORDER.indexOf(s)));
}

function reached(app: Application, stage: ApplicationStatus): boolean {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 && furthestStageIndex(app) >= idx;
}

function weekKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function computeAnalytics(
  applications: Application[],
  analyses: JobAnalysis[] = [],
  savedJobCount = 0,
): AnalyticsResponse {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 3600 * 1000;

  const applied = applications.filter((a) => reached(a, "applied"));
  const interviews = applications.filter((a) => reached(a, "interview"));
  const offers = applications.filter(
    (a) => a.status === "offer" || reached(a, "offer"),
  );
  const rejections = applications.filter((a) => a.status === "rejected");

  const thisWeek = applications.filter((a) => {
    const t = new Date(a.appliedAt ?? a.discoveredAt).getTime();
    return !Number.isNaN(t) && t >= weekAgo;
  });

  const scores = applications
    .map((a) => a.matchScore)
    .filter((s): s is number => s !== null);
  const averageMatchScore = scores.length
    ? round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  const funnel = FUNNEL_STAGES.map((stage) => ({
    stage,
    label: STATUS_LABELS[stage],
    count: applications.filter((a) => reached(a, stage)).length,
  }));

  const weeks: string[] = [];
  for (let i = 7; i >= 0; i--) {
    weeks.push(weekKey(new Date(now - i * 7 * 24 * 3600 * 1000).toISOString()));
  }
  const weekly = weeks.map((week) => ({
    week,
    applications: applied.filter(
      (a) => weekKey(a.appliedAt ?? a.discoveredAt) === week,
    ).length,
    interviews: interviews.filter((a) => eventWeek(a, ADVANCED) === week)
      .length,
    offers: offers.filter((a) => eventWeek(a, ["offer"]) === week).length,
    rejections: rejections.filter((a) => eventWeek(a, ["rejected"]) === week)
      .length,
  }));

  const buckets = [
    { bucket: "0-39", min: 0, max: 39 },
    { bucket: "40-59", min: 40, max: 59 },
    { bucket: "60-79", min: 60, max: 79 },
    { bucket: "80-100", min: 80, max: 100 },
  ];
  const scoreVsOutcome = buckets.map((b) => {
    const inBucket = applied.filter(
      (a) =>
        a.matchScore !== null && a.matchScore >= b.min && a.matchScore <= b.max,
    );
    const advanced = inBucket.filter((a) =>
      ADVANCED.some((s) => reached(a, s)),
    ).length;
    return {
      bucket: b.bucket,
      total: inBucket.length,
      advanced,
      rate: inBucket.length ? round((advanced / inBucket.length) * 100) : 0,
    };
  });

  const topCompanies = topCounts(
    applications.map((a) => a.company).filter(Boolean),
  );
  const topTitles = topCounts(applications.map((a) => a.title).filter(Boolean));

  const gapCounts = new Map<string, number>();
  const analysedJobs = new Set<string>();
  for (const analysis of analyses) {
    analysedJobs.add(analysis.jobId);
    const seen = new Set<string>();
    for (const m of analysis.skills) {
      if (m.quality === "missing" && m.required && !seen.has(m.skill)) {
        seen.add(m.skill);
        gapCounts.set(m.skill, (gapCounts.get(m.skill) ?? 0) + 1);
      }
    }
  }
  const totalAnalysed = Math.max(1, analysedJobs.size);
  const skillGaps = [...gapCounts.entries()]
    .map(([skill, jobsRequiring]) => ({
      skill,
      jobsRequiring,
      share: round((jobsRequiring / totalAnalysed) * 100),
    }))
    .sort((a, b) => b.jobsRequiring - a.jobsRequiring)
    .slice(0, 12);

  const highestMatches = [...applications]
    .filter((a) => a.matchScore !== null)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      company: a.company,
      title: a.title,
      score: a.matchScore ?? 0,
    }));

  return {
    totals: {
      applications: applications.length,
      thisWeek: thisWeek.length,
      interviews: interviews.length,
      offers: offers.length,
      rejections: rejections.length,
      savedJobs: savedJobCount,
    },
    averageMatchScore,

    responseRate: applied.length
      ? round(
          (applied.filter(
            (a) =>
              ADVANCED.some((s) => reached(a, s)) || a.status === "rejected",
          ).length /
            applied.length) *
            100,
        )
      : 0,
    interviewRate: applied.length
      ? round((interviews.length / applied.length) * 100)
      : 0,
    funnel,
    weekly,
    scoreVsOutcome,
    topCompanies,
    topTitles,
    skillGaps,
    highestMatches,
  };
}

function eventWeek(app: Application, statuses: ApplicationStatus[]): string {
  const event = [...app.timeline]
    .reverse()
    .find((e) => e.to !== null && statuses.includes(e.to));
  return weekKey(event?.at ?? app.updatedAt);
}

function topCounts(
  values: string[],
  limit = 8,
): Array<{ name: string; count: number }> {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
