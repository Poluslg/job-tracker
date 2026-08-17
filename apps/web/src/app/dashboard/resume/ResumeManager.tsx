'use client';

import { useState } from 'react';
import type { Resume, ResumeProfile } from '@job-ai/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Label,
  Textarea,
  useToast,
} from '@job-ai/ui';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { errorMessage, patch, post } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

export function ResumeManager({ initialResumes }: { initialResumes: Resume[] }) {
  const [resumes, setResumes] = useState(initialResumes);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const active = resumes.find((r) => r.isDefault) ?? resumes[0] ?? null;

  const upload = async () => {
    setUploading(true);
    try {
      const result = await post<{ resume: Resume }>('/api/resume/parse', {
        fileName: 'pasted-resume.txt',
        fileType: 'txt',
        text,
        useAI: false,
      });
      setResumes((prev) => [...prev.map((r) => ({ ...r, isDefault: false })), result.resume]);
      setText('');
      toast('Resume saved. Review the parsed fields below.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not save that resume.'), 'error');
    } finally {
      setUploading(false);
    }
  };

  if (!active) {
    return (
      <>
        <PageHeader title="Resume" />
        <Card>
          <CardBody>
            <EmptyState
              icon={<FileText className="h-8 w-8" strokeWidth={1.5} />}
              title="Upload your resume to start analyzing jobs"
              description="Paste the text here, or upload a PDF/DOCX from the Chrome extension where file parsing runs locally in your browser."
            />
            <div className="mx-auto max-w-2xl">
              <Label htmlFor="resume-text">Resume text</Label>
              <Textarea
                id="resume-text"
                rows={14}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="text-xs"
                placeholder="Paste your full resume…"
              />
              <Button
                className="mt-3"
                loading={uploading}
                disabled={text.trim().length < 100}
                onClick={() => void upload()}
              >
                <Plus className="h-4 w-4" /> Save resume
              </Button>
            </div>
          </CardBody>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Resume"
        description="Correct anything the parser got wrong — everything downstream reads these fields."
        actions={active.needsReview ? <Badge tone="warn">Needs review</Badge> : <Badge tone="strong">Reviewed</Badge>}
      />

      {active.needsReview && (
        <Alert tone="warn" className="mb-4" title="Check the parsed fields">
          Resumes vary wildly in layout, so the parser is best-effort. Fix anything that looks wrong
          before relying on a match score.
        </Alert>
      )}

      <ProfileEditor
        resume={active}
        onSaved={(updated) => {
          setResumes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          toast('Resume updated.', 'success');
        }}
        onError={(message) => toast(message, 'error')}
      />
    </>
  );
}

function ProfileEditor({
  resume,
  onSaved,
  onError,
}: {
  resume: Resume;
  onSaved: (resume: Resume) => void;
  onError: (message: string) => void;
}) {
  const [profile, setProfile] = useState<ResumeProfile>(resume.profile);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const result = await patch<{ resume: Resume }>('/api/resumes', {
        id: resume.id,
        profile,
        needsReview: false,
      });
      onSaved(result.resume);
    } catch (err) {
      onError(errorMessage(err, 'Could not save your changes.'));
    } finally {
      setBusy(false);
    }
  };

  const update = <K extends keyof ResumeProfile>(key: K, value: ResumeProfile[K]) =>
    setProfile((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-sm font-semibold">Contact</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ['name', 'Name'],
                ['email', 'Email'],
                ['phone', 'Phone'],
                ['location', 'Location'],
                ['linkedin', 'LinkedIn'],
                ['github', 'GitHub'],
                ['portfolio', 'Portfolio'],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={`contact-${key}`}>{label}</Label>
                <Input
                  id={`contact-${key}`}
                  value={profile.contact[key]}
                  onChange={(e) => update('contact', { ...profile.contact, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Label htmlFor="summary">Professional summary</Label>
          <Textarea
            id="summary"
            rows={4}
            value={profile.summary}
            onChange={(e) => update('summary', e.target.value)}
            className="text-xs"
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Label htmlFor="skills">Skills</Label>
          <Textarea
            id="skills"
            rows={4}
            value={profile.skills.map((s) => s.name).join(', ')}
            onChange={(e) =>
              update(
                'skills',
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((name) => ({ name, category: 'technical' as const, years: null })),
              )
            }
            className="text-xs"
          />
          <p className="mt-1 text-[11px] text-fg-subtle">
            Comma separated. Only list skills you have actually used — the match analysis is only as
            honest as this list.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-sm font-semibold">Experience ({profile.experience.length})</h2>
          {profile.experience.map((exp, index) => (
            <div key={exp.id} className="rounded-lg border border-border p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    ['title', 'Title'],
                    ['company', 'Company'],
                    ['startDate', 'Start'],
                    ['endDate', 'End'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <Label htmlFor={`exp-${index}-${key}`}>{label}</Label>
                    <Input
                      id={`exp-${index}-${key}`}
                      value={exp[key]}
                      placeholder={key === 'endDate' && exp.current ? 'Present' : ''}
                      onChange={(e) => {
                        const next = [...profile.experience];
                        next[index] = { ...exp, [key]: e.target.value };
                        update('experience', next);
                      }}
                    />
                  </div>
                ))}
              </div>
              <Textarea
                rows={3}
                className="mt-2 text-xs"
                aria-label={`Bullet points for ${exp.title || 'this role'}`}
                value={[...exp.achievements, ...exp.responsibilities].join('\n')}
                onChange={(e) => {
                  const lines = e.target.value.split('\n').filter((l) => l.trim());
                  const next = [...profile.experience];
                  next[index] = { ...exp, achievements: [], responsibilities: lines };
                  update('experience', next);
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() =>
                  update(
                    'experience',
                    profile.experience.filter((e2) => e2.id !== exp.id),
                  )
                }
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove role
              </Button>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-sm font-semibold">Education ({profile.education.length})</h2>
          {profile.education.map((edu, index) => (
            <div key={edu.id} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ['degree', 'Degree'],
                  ['field', 'Field'],
                  ['institution', 'Institution'],
                  ['endDate', 'Year'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <Label htmlFor={`edu-${index}-${key}`}>{label}</Label>
                  <Input
                    id={`edu-${index}-${key}`}
                    value={edu[key]}
                    onChange={(e) => {
                      const next = [...profile.education];
                      next[index] = { ...edu, [key]: e.target.value };
                      update('education', next);
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button loading={busy} onClick={() => void save()}>
          Save resume
        </Button>
      </div>
    </div>
  );
}
