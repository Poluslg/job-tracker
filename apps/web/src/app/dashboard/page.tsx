import Link from "next/link";
import { computeAnalytics } from "@job-ai/core";
import {
  Badge,
  Card,
  CardBody,
  EmptyState,
  StatusBadge,
  bandFor,
} from "@job-ai/ui";
import { ArrowRight, Briefcase } from "lucide-react";
import { loadUserData } from "@/server/data";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader, StatTile } from "@/components/PageHeader";
import { SeedDemoButton } from "./SeedDemoButton";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
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
        <PageHeader title="Overview" />
        <Card>
          <EmptyState
            icon={<Briefcase className="h-8 w-8" strokeWidth={1.5} />}
            title="Your job application tracker is empty"
            description="Install the Chrome extension, open any job listing, and save it to start building your pipeline. You can also analyze a posting here by pasting it in."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/dashboard/analyzer">
                  Analyze a job
                </LinkButton>
                <SeedDemoButton />
              </div>
            }
          />
        </Card>
      </>
    );
  }

  const recent = [...data.applications]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Your pipeline at a glance."
        actions={
          <LinkButton href="/dashboard/applications" variant="outline">
            All applications
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Applications" value={analytics.totals.applications} />
        <StatTile label="This week" value={analytics.totals.thisWeek} />
        <StatTile label="Interviews" value={analytics.totals.interviews} />
        <StatTile label="Offers" value={analytics.totals.offers} />
        <StatTile label="Rejections" value={analytics.totals.rejections} />
        <StatTile
          label="Avg match score"
          value={analytics.averageMatchScore ?? "—"}
          hint="Alignment estimate"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Application funnel</h2>
              <span className="text-xs text-fg-subtle">
                Furthest stage reached
              </span>
            </div>
            <div className="space-y-2">
              {analytics.funnel.map((stage) => {
                const width = analytics.totals.applications
                  ? (stage.count / analytics.totals.applications) * 100
                  : 0;
                return (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-xs text-fg-muted">
                      {stage.label}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-surface-muted">
                      <div
                        className="h-full rounded bg-brand/80"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs tabular-nums text-fg">
                      {stage.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Rates</h2>
              <p className="mt-0.5 text-[11px] text-fg-subtle">
                Based on applications you submitted.
              </p>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-fg-muted">Response rate</span>
                <span className="text-sm font-semibold tabular-nums">
                  {analytics.responseRate}%
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-fg-subtle">
                Any reply, including a rejection.
              </p>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-fg-muted">Interview rate</span>
                <span className="text-sm font-semibold tabular-nums">
                  {analytics.interviewRate}%
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
            <ul className="space-y-2">
              {recent.map((app) => (
                <li
                  key={app.id}
                  className="flex items-center justify-between gap-3"
                >
                  <Link
                    href={`/dashboard/applications/${app.id}`}
                    className="min-w-0 flex-1 hover:underline"
                  >
                    <span className="block truncate text-xs font-medium text-fg">
                      {app.title}
                    </span>
                    <span className="block truncate text-[11px] text-fg-muted">
                      {app.company}
                    </span>
                  </Link>
                  <StatusBadge status={app.status} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Highest match jobs</h2>
            {analytics.highestMatches.length === 0 ? (
              <p className="text-xs text-fg-muted">
                Analyze some jobs to see this.
              </p>
            ) : (
              <ul className="space-y-2">
                {analytics.highestMatches.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-fg">
                        {m.title}
                      </span>
                      <span className="block truncate text-[11px] text-fg-muted">
                        {m.company}
                      </span>
                    </span>
                    <Badge tone={bandFor(m.score).tone}>{m.score}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/dashboard/analytics"
              className="mt-4 inline-flex items-center gap-1 text-xs text-brand hover:underline"
            >
              Full analytics <ArrowRight className="h-3 w-3" />
            </Link>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
