import { Alert, Badge, Card, CardBody, EmptyState } from '@job-ai/ui';
import { MessageSquare } from 'lucide-react';
import { loadUserData } from '@/server/data';
import { LinkButton } from '@/components/LinkButton';
import { PageHeader } from '@/components/PageHeader';

export const metadata = { title: 'Interview Prep' };
export const dynamic = 'force-dynamic';

const CATEGORY_LABELS = {
  technical: 'Technical',
  behavioral: 'Behavioral',
  'resume-based': 'Your resume',
  'company-role': 'Role & team',
} as const;

export default async function InterviewPrepPage() {
  const { data } = await loadUserData();
  const preps = [...data.interviewPreps].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const jobById = new Map(data.jobs.map((j) => [j.id, j]));

  return (
    <>
      <PageHeader
        title="Interview Prep"
        description="Preparation workspaces built from each posting and your actual resume."
      />

      {preps.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MessageSquare className="h-8 w-8" strokeWidth={1.5} />}
            title="No interview prep yet"
            description="Analyze a job and choose “Prepare for interview” to build a workspace for it."
            action={<LinkButton href="/dashboard/analyzer">Analyze a job</LinkButton>}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <Alert tone="neutral">
            Answer guidance is a framework to build on with your own real experience — never a script
            to recite. An honest answer about a gap is stronger than a rehearsed claim.
          </Alert>

          {preps.map((prep) => {
            const job = jobById.get(prep.jobId);
            return (
              <Card key={prep.id}>
                <CardBody>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-fg">{job?.title ?? 'Saved role'}</p>
                      <p className="text-xs text-fg-muted">{job?.company ?? ''}</p>
                    </div>
                    <Badge size="sm">{prep.questions.length} questions</Badge>
                  </div>

                  <div className="mt-4 space-y-4">
                    {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((category) => {
                      const questions = prep.questions.filter((q) => q.category === category);
                      if (questions.length === 0) return null;
                      return (
                        <section key={category}>
                          <p className="text-xs font-medium text-fg">{CATEGORY_LABELS[category]}</p>
                          <div className="mt-1.5 space-y-2">
                            {questions.map((q) => (
                              <details key={q.id} className="rounded-lg border border-border px-3 py-2">
                                <summary className="cursor-pointer text-xs font-medium text-fg">
                                  {q.question}
                                </summary>
                                <p className="mt-2 text-[11px] leading-relaxed text-fg-muted">
                                  {q.answerFramework}
                                </p>
                                {q.drawFrom.length > 0 && (
                                  <p className="mt-1.5 text-[11px] text-fg-subtle">
                                    Draw on: {q.drawFrom.join('; ')}
                                  </p>
                                )}
                              </details>
                            ))}
                          </div>
                        </section>
                      );
                    })}

                    {prep.questionsToAsk.length > 0 && (
                      <section>
                        <p className="text-xs font-medium text-fg">Questions to ask them</p>
                        <ul className="mt-1 space-y-1">
                          {prep.questionsToAsk.map((q, i) => (
                            <li key={i} className="text-[11px] text-fg-muted">• {q}</li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {prep.studyTopics.length > 0 && (
                      <section>
                        <p className="text-xs font-medium text-fg">What to study</p>
                        <ul className="mt-1 space-y-1">
                          {prep.studyTopics.map((t, i) => (
                            <li key={i} className="text-[11px] text-fg-muted">• {t}</li>
                          ))}
                        </ul>
                      </section>
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
