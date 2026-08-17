import Link from 'next/link';
import { Badge, Card, CardBody, EmptyState, bandFor } from '@job-ai/ui';
import { Bookmark, ExternalLink } from 'lucide-react';
import { loadUserData } from '@/server/data';
import { LinkButton } from '@/components/LinkButton';
import { PageHeader } from '@/components/PageHeader';

export const metadata = { title: 'Saved Jobs' };
export const dynamic = 'force-dynamic';

export default async function SavedJobsPage() {
  const { data } = await loadUserData();
  const trackedJobIds = new Set(data.applications.map((a) => a.jobId));

  const scoreByJob = new Map<string, number>();
  for (const analysis of data.analyses) {
    if (!scoreByJob.has(analysis.jobId)) scoreByJob.set(analysis.jobId, analysis.score.overall);
  }

  const jobs = [...data.jobs].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));

  return (
    <>
      <PageHeader
        title="Saved Jobs"
        description="Every posting you've captured, whether or not it's in your tracker."
        actions={<LinkButton href="/dashboard/analyzer" variant="outline">Analyze a job</LinkButton>}
      />

      {jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bookmark className="h-8 w-8" strokeWidth={1.5} />}
            title="No saved jobs yet"
            description="Open a job listing with the Chrome extension and save it, or paste one into the Job Analyzer."
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => {
            const score = scoreByJob.get(job.id);
            const tracked = trackedJobIds.has(job.id);
            return (
              <Card key={job.id}>
                <CardBody className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{job.title || 'Untitled role'}</p>
                      <p className="truncate text-xs text-fg-muted">{job.company}</p>
                    </div>
                    {score !== undefined && <Badge tone={bandFor(score).tone}>{score}</Badge>}
                  </div>

                  <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-fg-subtle">
                    {job.description.slice(0, 220)}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {job.location && <Badge size="sm">{job.location}</Badge>}
                    {job.arrangement !== 'unknown' && <Badge size="sm">{job.arrangement}</Badge>}
                    {job.platform !== 'generic' && <Badge size="sm">{job.platform}</Badge>}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    {tracked ? (
                      <Badge tone="strong" size="sm">In tracker</Badge>
                    ) : (
                      <Link href="/dashboard/applications" className="text-xs text-brand hover:underline">
                        Not tracked
                      </Link>
                    )}
                    {job.url && (
                      <a
                        href={job.url.startsWith('http') ? job.url : 'https://' + job.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label={`Open the posting for ${job.title}`}
                        className="rounded-md p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
