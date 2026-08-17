'use client';

import type { ApplicationStatus, JobAnalysis, ScoreBreakdown, SkillMatch } from '@job-ai/types';
import { STATUS_LABELS } from '@job-ai/types';
import { useState } from 'react';
import { Badge, Card, CardBody, Progress, Tooltip } from './primitives.tsx';
import { cn } from './cn.ts';

import { SCORE_DISCLAIMER, STATUS_TONE, bandFor, type ScoreTone } from './bands.ts';

const TONE_STROKE: Record<ScoreTone, string> = {
  strong: 'text-strong',
  good: 'text-good',
  warn: 'text-warn',
  danger: 'text-danger',
};

export function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const band = bandFor(score);
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Job match score ${Math.round(score)} out of 100 — ${band.label}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth="7"
          className="stroke-surface-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('stroke-current transition-[stroke-dashoffset]', TONE_STROKE[band.tone])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-fg">{Math.round(score)}</span>
        <span className="text-[10px] text-fg-subtle">/ 100</span>
      </div>
    </div>
  );
}

export function ScoreExplanation({ score }: { score: ScoreBreakdown }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {score.components.map((c) => {
        const contribution = c.score * c.weight;
        const open = expanded === c.key;
        return (
          <div key={c.key} className="rounded-lg border border-border bg-surface">
            <button
              type="button"
              onClick={() => setExpanded(open ? null : c.key)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-3 py-2 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-fg">{c.label}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-fg-muted">
                    {Math.round(c.score)} × {Math.round(c.weight * 100)}% ={' '}
                    <span className="font-medium text-fg">{contribution.toFixed(1)}</span>
                  </span>
                </span>
                <Progress
                  value={c.score}
                  tone={bandFor(c.score).tone}
                  className="mt-1.5"
                  label={`${c.label} score`}
                />
              </span>
            </button>
            {open && (
              <div className="border-t border-border px-3 py-2">
                <p className="text-xs leading-relaxed text-fg-muted">{c.explanation}</p>
                {c.details.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {c.details.slice(0, 12).map((d, i) => (
                      <li key={i} className="text-[11px] text-fg-subtle">
                        • {d}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
      <p className="pt-1 text-[11px] leading-relaxed text-fg-subtle">
        Total: {score.overall} / 100 · scoring engine v{score.engineVersion}. {SCORE_DISCLAIMER}
      </p>
    </div>
  );
}

const QUALITY_META = {
  strong: { tone: 'strong', icon: '✓', label: 'Strong match' },
  partial: { tone: 'warn', icon: '≈', label: 'Partial match' },
  missing: { tone: 'danger', icon: '!', label: 'Not found' },
} as const;

export function SkillPill({ match }: { match: SkillMatch }) {
  const meta = QUALITY_META[match.quality];
  return (
    <Tooltip content={`${meta.label}. ${match.rationale}`}>
      <Badge tone={meta.tone} className="max-w-full">
        <span aria-hidden="true">{meta.icon}</span>
        <span className="truncate">{match.skill}</span>
        {match.required && <span className="text-[9px] opacity-70">req</span>}
      </Badge>
    </Tooltip>
  );
}

export function SkillMatchGroups({ skills }: { skills: SkillMatch[] }) {
  const groups = [
    { key: 'strong', title: 'Strong matches', hint: 'Clearly present in both your resume and the posting.' },
    { key: 'partial', title: 'Partial matches', hint: 'Your resume shows related experience, not the exact requirement.' },
    { key: 'missing', title: 'Not found in your resume', hint: 'Only add these if you genuinely have the experience.' },
  ] as const;

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const items = skills.filter((s) => s.quality === g.key);
        if (items.length === 0) return null;
        return (
          <div key={g.key}>
            <p className="text-xs font-medium text-fg">
              {g.title} <span className="text-fg-subtle">({items.length})</span>
            </p>
            <p className="mt-0.5 text-[11px] text-fg-subtle">{g.hint}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {items.map((s) => (
                <SkillPill key={`${s.skill}-${s.quality}`} match={s} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AtsPanel({ analysis }: { analysis: JobAnalysis }) {
  const { ats } = analysis;
  const missingImportant = ats.missing.filter((k) => k.important);

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-fg">Keyword coverage</span>
            <span className="text-sm font-semibold tabular-nums text-fg">{ats.coverage}%</span>
          </div>
          <Progress value={ats.coverage} tone={bandFor(ats.coverage).tone} label="ATS keyword coverage" />
          <p className="text-[11px] text-fg-subtle">
            Share of the posting&rsquo;s highest-signal terms that appear somewhere in your resume.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-fg">Job title alignment</span>
            <span className="text-sm font-semibold tabular-nums text-fg">{ats.titleAlignment}%</span>
          </div>
          <p className="text-[11px] leading-relaxed text-fg-muted">{ats.titleNote}</p>
        </CardBody>
      </Card>

      {missingImportant.length > 0 && (
        <div>
          <p className="text-xs font-medium text-fg">Important terms not in your resume</p>
          <p className="mt-0.5 text-[11px] text-danger">
            Do not add a keyword unless you genuinely have that experience. Padding a resume with
            terms you cannot discuss will not survive an interview.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missingImportant.slice(0, 20).map((k) => (
              <Tooltip key={k.keyword} content={`Appears ${k.inJob}× in the posting, 0× in your resume.`}>
                <Badge tone="danger">{k.keyword}</Badge>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {ats.found.length > 0 && (
        <div>
          <p className="text-xs font-medium text-fg">Terms you already cover</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ats.found.slice(0, 20).map((k) => (
              <Tooltip key={k.keyword} content={`${k.inJob}× in the posting, ${k.inResume}× in your resume.`}>
                <Badge tone="strong">{k.keyword}</Badge>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {ats.issues.length > 0 && (
        <div>
          <p className="text-xs font-medium text-fg">Possible parsing issues</p>
          <ul className="mt-1.5 space-y-1">
            {ats.issues.map((issue, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-fg-muted">
                • {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>;
}

