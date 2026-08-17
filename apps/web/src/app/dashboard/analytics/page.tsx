import { computeAnalytics } from "@job-ai/core";
import { Alert, Card, CardBody, EmptyState } from "@job-ai/ui";
import { BarChart3 } from "lucide-react";
import { loadUserData } from "@/server/data";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader, StatTile } from "@/components/PageHeader";
import { AnalyticsCharts } from "./AnalyticsCharts.tsx";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { data } = await loadUserData();
  const trackedJobIds = new Set(data.applications.map((a) => a.jobId));
  const analytics = computeAnalytics(
    data.applications,
    data.analyses,
    data.jobs.filter((j) => !trackedJobIds.has(j.id)).length,
  );

  if (data.applications.length === 0) {
    return (
      <>
        <PageHeader title="Analytics" />
        <Card>
          <EmptyState
            icon={<BarChart3 className="h-8 w-8" strokeWidth={1.5} />}
            title="Nothing to analyze yet"
            description="Analytics appear once you have applications in your tracker."
            action={
              <LinkButton href="/dashboard/analyzer">Analyze a job</LinkButton>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Patterns across your own search. Small samples move these numbers a lot — read them as signals, not conclusions."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Response rate"
          value={`${analytics.responseRate}%`}
          hint="Any reply after applying"
        />
        <StatTile
          label="Interview rate"
          value={`${analytics.interviewRate}%`}
          hint="Reached an interview"
        />
        <StatTile
          label="Avg match score"
          value={analytics.averageMatchScore ?? "—"}
        />
        <StatTile
          label="Saved, not applied"
          value={analytics.totals.savedJobs}
        />
      </div>

      <AnalyticsCharts analytics={analytics} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold">Skill gap analysis</h2>
            <p className="mt-0.5 text-[11px] text-fg-subtle">
              Skills required by jobs you analyzed that your resume does not
              evidence. These are the highest-leverage things to learn — or to
              add, if you already have the experience and simply have not
              written it down.
            </p>
            {analytics.skillGaps.length === 0 ? (
              <p className="mt-3 text-xs text-fg-muted">
                No repeated gaps found. Your resume covers the required skills
                in the jobs you have analyzed.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {analytics.skillGaps.map((gap) => (
                  <div key={gap.skill} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate text-xs text-fg">
                      {gap.skill}
                    </span>
                    <div className="h-4 flex-1 overflow-hidden rounded bg-surface-muted">
                      <div
                        className="h-full rounded bg-warn/70"
                        style={{ width: `${gap.share}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-fg-muted">
                      {gap.jobsRequiring}{" "}
                      {gap.jobsRequiring === 1 ? "job" : "jobs"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody>
              <h2 className="mb-2 text-sm font-semibold">
                Companies applied to
              </h2>
              <RankedList
                items={analytics.topCompanies}
                empty="No companies recorded yet."
              />
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <h2 className="mb-2 text-sm font-semibold">
                Most common job titles
              </h2>
              <RankedList
                items={analytics.topTitles}
                empty="No titles recorded yet."
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <Alert tone="neutral" className="mt-4">
        The match-score comparison below is descriptive: it reports what
        happened in your own history. It does not show that a higher score
        causes a better outcome, and it cannot account for timing, referrals, or
        how many other people applied.
      </Alert>
    </>
  );
}

function RankedList({
  items,
  empty,
}: {
  items: Array<{ name: string; count: number }>;
  empty: string;
}) {
  if (items.length === 0)
    return <p className="text-xs text-fg-muted">{empty}</p>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-xs text-fg-muted">
            {item.name}
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded bg-surface-muted">
            <div
              className="h-full rounded bg-brand/60"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-fg">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
