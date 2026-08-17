import { useState } from 'react';
import type { InterviewPrep, InterviewQuestion, JobPosting } from '@job-ai/types';
import { Alert, Badge, Button, Card, CardBody, Skeleton, Tabs, TabPanel } from '@job-ai/ui';
import { MessageError, send } from '../../lib/messaging.ts';

const CATEGORY_LABELS: Record<InterviewQuestion['category'], string> = {
  technical: 'Technical',
  behavioral: 'Behavioral',
  'resume-based': 'Your resume',
  'company-role': 'Role & team',
};

export function InterviewPanel({ job }: { job: JobPosting }) {
  const [prep, setPrep] = useState<InterviewPrep | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>('technical');
  const [open, setOpen] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await send({ type: 'GENERATE_INTERVIEW_PREP', payload: { jobId: job.id } });
      setPrep(result.prep);
      setTab(result.prep.questions[0]?.category ?? 'technical');
    } catch (err) {
      setError(err instanceof MessageError ? err.message : 'Could not build your prep workspace.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-fg-muted">Building your preparation workspace…</p>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!prep) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Prepare for interview</h2>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            Questions drawn from this posting and your actual resume — including the ones about gaps.
            Answers are frameworks to build on, never scripts to recite.
          </p>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button block onClick={() => void start()}>
          Start interview prep
        </Button>
      </div>
    );
  }

  const categories = (['technical', 'behavioral', 'resume-based', 'company-role'] as const).filter((c) =>
    prep.questions.some((q) => q.category === c),
  );

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">
        Prep for {job.title} · {job.company}
      </h2>

      <Tabs
        size="sm"
        active={tab}
        onChange={setTab}
        items={[
          ...categories.map((c) => ({
            id: c,
            label: CATEGORY_LABELS[c],
            badge: prep.questions.filter((q) => q.category === c).length,
          })),
          { id: 'notes', label: 'Study' },
        ]}
      />

      {categories.map((category) => (
        <TabPanel key={category} id={category} active={tab}>
          <div className="space-y-2">
            {prep.questions
              .filter((q) => q.category === category)
              .map((q) => (
                <Card key={q.id}>
                  <CardBody className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setOpen(open === q.id ? null : q.id)}
                      aria-expanded={open === q.id}
                      className="flex w-full items-start justify-between gap-2 text-left"
                    >
                      <span className="text-xs leading-relaxed font-medium text-fg">{q.question}</span>
                      <Badge
                        size="sm"
                        tone={q.difficulty === 'hard' ? 'danger' : q.difficulty === 'medium' ? 'warn' : 'neutral'}
                      >
                        {q.difficulty}
                      </Badge>
                    </button>
                    {open === q.id && (
                      <div className="border-t border-border pt-2">
                        <p className="text-[10px] font-medium text-fg-subtle">How to approach it</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-fg-muted">{q.answerFramework}</p>
                        {q.drawFrom.length > 0 && (
                          <>
                            <p className="mt-2 text-[10px] font-medium text-fg-subtle">Draw on</p>
                            <ul className="mt-0.5 space-y-0.5">
                              {q.drawFrom.map((d, i) => (
                                <li key={i} className="text-[11px] text-fg-muted">
                                  • {d}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
          </div>
        </TabPanel>
      ))}

      <TabPanel id="notes" active={tab}>
        <div className="space-y-4">
          <Section title="Talking points" items={prep.talkingPoints} />
          <Section title="Questions to ask them" items={prep.questionsToAsk} />
          <Section title="What to study" items={prep.studyTopics} />
        </div>
      </TabPanel>

      <Alert tone="neutral">
        These are preparation frameworks, not answers. Fill them with things you actually did — an
        honest answer about a gap is stronger than a rehearsed claim you cannot defend.
      </Alert>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <p className="text-xs font-medium text-fg">{title}</p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-[11px] leading-relaxed text-fg-muted">
            • {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
