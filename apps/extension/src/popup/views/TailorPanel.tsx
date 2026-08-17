import { useState } from 'react';
import type { JobAnalysis, JobPosting, TailorChange } from '@job-ai/types';
import { Alert, Badge, Button, Card, CardBody, Input, Label, Skeleton, useToast } from '@job-ai/ui';
import { Check, Download, X } from 'lucide-react';
import { MessageError, send } from '../../lib/messaging.ts';
import { downloadBytes } from '../../lib/download.ts';
import {
  DOCX_MIME_TYPE,
  PDF_MIME_TYPE,
  buildDocx,
  buildPdf,
  resumeTextToBlocks,
  resumeTextToPdfBlocks,
} from '@job-ai/core';

type Decision = 'pending' | 'accepted' | 'rejected';

export function TailorPanel({ job, analysis }: { job: JobPosting; analysis: JobAnalysis }) {
  const [versionName, setVersionName] = useState(
    `${job.title || 'Tailored'} — ${job.company || 'Resume'}`.slice(0, 60),
  );
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState<TailorChange[] | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await send({
        type: 'TAILOR_RESUME',
        payload: {
          jobId: job.id,
          analysisId: analysis.id,
          acceptedIds: analysis.recommendations.filter((r) => !r.needsUserConfirmation).map((r) => r.id),
          versionName,
        },
      });
      setChanges(result.changes);
      setDecisions(Object.fromEntries(result.changes.map((c) => [c.id, 'pending' as Decision])));
    } catch (err) {
      setError(err instanceof MessageError ? err.message : 'Could not generate a tailored resume.');
    } finally {
      setLoading(false);
    }
  };

  const acceptedText = (): string => {
    if (!changes) return '';
    const lines: string[] = [versionName, ''];
    for (const c of changes) {
      if (decisions[c.id] !== 'accepted') continue;
      lines.push(c.section.toUpperCase(), edits[c.id] ?? c.suggested, '');
    }
    return lines.join('\n');
  };

  const acceptedCount = Object.values(decisions).filter((d) => d === 'accepted').length;

  const download = async (format: 'pdf' | 'docx') => {
    const text = acceptedText();
    if (!text.trim()) {
      toast('Accept at least one change before downloading.', 'error');
      return;
    }
    const safeName = versionName.replace(/[^\w -]/g, '').trim() || 'tailored-resume';
    if (format === 'docx') {
      await downloadBytes(buildDocx(resumeTextToBlocks(text)), `${safeName}.docx`, DOCX_MIME_TYPE);
    } else {
      await downloadBytes(buildPdf(resumeTextToPdfBlocks(text), versionName), `${safeName}.pdf`, PDF_MIME_TYPE);
    }
    toast(`Downloaded ${safeName}.${format}`, 'success');
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-fg-muted">Rewriting your resume for this role…</p>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!changes) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Tailor my resume</h2>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            Suggestions are drawn only from what your resume already says. Nothing is invented, and
            you review every change before anything is downloaded.
          </p>
        </div>

        <div>
          <Label htmlFor="version-name">Version name</Label>
          <Input
            id="version-name"
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            maxLength={60}
          />
          <p className="mt-1 text-[11px] text-fg-subtle">
            The tracker records which version you used for each application.
          </p>
        </div>

        {error && <Alert tone="danger">{error}</Alert>}

        <Button block onClick={() => void generate()} disabled={!versionName.trim()}>
          Generate suggestions
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Review changes</h2>
        <span className="text-xs text-fg-muted">
          {acceptedCount} of {changes.length} accepted
        </span>
      </div>

      {changes.length === 0 && (
        <Alert tone="neutral">
          No changes were proposed. Your resume already reflects what this posting asks for.
        </Alert>
      )}

      {changes.map((change) => {
        const decision = decisions[change.id] ?? 'pending';
        return (
          <Card key={change.id} className={decision === 'rejected' ? 'opacity-50' : ''}>
            <CardBody className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-fg">{change.section}</p>
                {change.needsUserConfirmation && (
                  <Badge tone="warn" size="sm">
                    Needs confirmation
                  </Badge>
                )}
              </div>

              {change.original && (
                <div>
                  <p className="text-[10px] font-medium text-fg-subtle">Original</p>
                  <p className="mt-0.5 rounded-md bg-danger-subtle/40 px-2 py-1.5 text-[11px] leading-relaxed text-fg-muted line-through decoration-danger/40">
                    {change.original}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-medium text-fg-subtle">Suggested</p>
                <textarea
                  value={edits[change.id] ?? change.suggested}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [change.id]: e.target.value }))}
                  rows={3}
                  aria-label={`Suggested text for ${change.section}`}
                  className="mt-0.5 w-full rounded-md border border-border bg-strong-subtle/30 px-2 py-1.5 text-[11px] leading-relaxed text-fg"
                />
              </div>

              {change.reason && <p className="text-[10px] text-fg-subtle">Why: {change.reason}</p>}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={decision === 'accepted' ? 'primary' : 'outline'}
                  onClick={() => setDecisions((p) => ({ ...p, [change.id]: 'accepted' }))}
                >
                  <Check className="h-3.5 w-3.5" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant={decision === 'rejected' ? 'danger' : 'ghost'}
                  onClick={() => setDecisions((p) => ({ ...p, [change.id]: 'rejected' }))}
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            </CardBody>
          </Card>
        );
      })}

      <Alert tone="warn">
        Read every accepted change before you send this resume. If a rewrite implies something you
        cannot speak to in an interview, edit it or reject it.
      </Alert>

      <div className="flex gap-2">
        <Button block variant="outline" onClick={() => void download('pdf')}>
          <Download className="h-4 w-4" /> PDF
        </Button>
        <Button block variant="outline" onClick={() => void download('docx')}>
          <Download className="h-4 w-4" /> DOCX
        </Button>
      </div>
    </div>
  );
}
