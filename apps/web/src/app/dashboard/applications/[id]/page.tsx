import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  AtsPanel,
  Badge,
  Card,
  CardBody,
  ScoreExplanation,
  ScoreRing,
  SkillMatchGroups,
  StatusBadge,
  bandFor,
} from '@job-ai/ui';
import { STATUS_LABELS } from '@job-ai/types';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { loadUserData } from '@/server/data';
import { PageHeader } from '@/components/PageHeader';
import { ApplicationNotes } from './ApplicationNotes.tsx';

export const dynamic = 'force-dynamic';

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await loadUserData();
  const application = data.applications.find((a) => a.id === id);
  if (!application) notFound();

  const analysis =
    data.analyses.find((a) => a.id === application.analysisId) ??
    data.analyses.find((a) => a.jobId === application.jobId) ??
    null;
  const coverLetter = data.coverLetters.find((c) => c.id === application.coverLetterId) ?? null;
  const prep = data.interviewPreps.find((p) => p.id === application.interviewPrepId) ?? null;

  return (
    <>
      <Link
        href="/dashboard/applications"
        className="mb-4 inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All applications
      </Link>

      <PageHeader
        title={application.title || 'Untitled role'}
        description={[application.company, application.location, application.salary]
          .filter(Boolean)
          .join(' · ')}
        actions={
          application.url ? (
            <a
              href={application.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong px-4 text-sm hover:bg-surface-muted"
            >
              Original posting <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {analysis ? (
            <>
              <Card>
                <CardBody className="flex flex-wrap items-center gap-5">
                  <ScoreRing score={analysis.score.overall} />
                  <div className="min-w-0 flex-1">
                    <Badge tone={bandFor(analysis.score.overall).tone}>
                      {bandFor(analysis.score.overall).label}
                    </Badge>
                    <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                      {analysis.skills.filter((s) => s.quality === 'strong').length} skills matched ·{' '}
                      {analysis.skills.filter((s) => s.quality === 'missing' && s.required).length} required
                      gaps · ATS coverage {analysis.ats.coverage}%
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-fg-subtle">
                      An analytical estimate of resume-to-posting alignment. It is not a prediction of
                      whether you will be contacted, interviewed or hired.
                    </p>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <h2 className="mb-3 text-sm font-semibold">Skills</h2>
                  <SkillMatchGroups skills={analysis.skills} />
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <h2 className="mb-3 text-sm font-semibold">ATS analysis</h2>
                  <AtsPanel analysis={analysis} />
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <h2 className="mb-3 text-sm font-semibold">How this score was calculated</h2>
                  <ScoreExplanation score={analysis.score} />
                </CardBody>
              </Card>
            </>
          ) : (
            <Card>
              <CardBody>
                <p className="text-sm text-fg-muted">
                  No analysis is stored for this application yet. Open the posting with the extension,
                  or paste it into the Job Analyzer, to generate one.
                </p>
              </CardBody>
            </Card>
          )}

          {coverLetter && (
            <Card>
              <CardBody>
                <h2 className="mb-2 text-sm font-semibold">Cover letter</h2>
                <p className="text-xs whitespace-pre-wrap text-fg-muted">{coverLetter.body}</p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-fg-muted">Status</span>
                <StatusBadge status={application.status} />
              </div>
              <Detail label="Discovered" value={new Date(application.discoveredAt).toLocaleDateString()} />
              <Detail
                label="Applied"
                value={application.appliedAt ? new Date(application.appliedAt).toLocaleDateString() : '—'}
              />
              <Detail label="Resume version" value={application.resumeVersionName || 'Not recorded'} />
              <Detail label="Job type" value={application.jobType || '—'} />
              {application.recruiter.name && (
                <Detail
                  label="Recruiter"
                  value={`${application.recruiter.name}${application.recruiter.email ? ` · ${application.recruiter.email}` : ''}`}
                />
              )}
              {prep && <Detail label="Interview prep" value={`${prep.questions.length} questions`} />}
            </CardBody>
          </Card>

          <ApplicationNotes id={application.id} initialNotes={application.notes} />

          <Card>
            <CardBody>
              <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
              <ol className="space-y-2">
                {[...application.timeline].reverse().map((event) => (
                  <li key={event.id} className="flex gap-3 text-xs">
                    <span className="w-20 shrink-0 text-fg-subtle">
                      {new Date(event.at).toLocaleDateString()}
                    </span>
                    <span className="text-fg-muted">
                      {event.to ? STATUS_LABELS[event.to] : event.text}
                    </span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-fg-muted">{label}</span>
      <span className="truncate text-xs text-fg">{value}</span>
    </div>
  );
}
