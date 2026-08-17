'use client';

import { useCallback, useRef, useState } from 'react';
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
  Skeleton,
  Spinner,
  Textarea,
  useToast,
} from '@job-ai/ui';
import { FileText, Plus, Trash2, Upload, X } from 'lucide-react';
import { errorMessage, patch, post } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

type FileStatus = 'idle' | 'reading' | 'uploading';

async function extractTextFromFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('useAI', 'false');

  const res = await fetch('/api/extract', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to extract text from file.');
  }

  const data = await res.json();
  return data.text;
}

export function ResumeManager({ initialResumes }: { initialResumes: Resume[] }) {
  const [resumes, setResumes] = useState(initialResumes);
  const [text, setText] = useState('');
  const [fileStatus, setFileStatus] = useState<FileStatus>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tab, setTab] = useState<'upload' | 'paste'>('upload');
  const [isUploadingNew, setIsUploadingNew] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const active = resumes.find((r) => r.isDefault) ?? resumes[0] ?? null;

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['pdf', 'docx', 'txt'].includes(ext ?? '')) {
        toast('Unsupported file type. Please use PDF, DOCX, or TXT.', 'error');
        return;
      }
      setSelectedFile(file);
      setFileStatus('reading');
      try {
        const extractedText = await extractTextFromFile(file);
        if (extractedText.trim().length < 50) {
          toast('The file appears to be empty or could not be read.', 'error');
          setFileStatus('idle');
          return;
        }
        setFileStatus('uploading');
        const result = await post<{ resume: Resume; usedAI?: boolean }>('/api/resume/parse', {
          fileName: file.name,
          fileType: ext as 'pdf' | 'docx' | 'txt',
          text: extractedText,
          useAI: true,
        });
        console.log("result",result)
        setResumes((prev) => [...prev.map((r) => ({ ...r, isDefault: false })), result.resume]);
        setSelectedFile(null);
        setIsUploadingNew(false);
        const msg = result.usedAI
          ? 'Resume parsed with AI — all fields auto-filled. Review them below.'
          : 'Resume uploaded. Please review and correct the parsed fields.';
        toast(msg, 'success');
      } catch (err) {
        toast(errorMessage(err, 'Could not read or upload that file.'), 'error');
      } finally {
        setFileStatus('idle');
      }
    },
    [toast],
  );

  const uploadText = async () => {
    setFileStatus('uploading');
    try {
      const result = await post<{ resume: Resume; usedAI?: boolean }>('/api/resume/parse', {
        fileName: 'pasted-resume.txt',
        fileType: 'txt',
        text,
        useAI: true,
      });
      setResumes((prev) => [...prev.map((r) => ({ ...r, isDefault: false })), result.resume]);
      setText('');
      setIsUploadingNew(false);
      const msg = result.usedAI
        ? 'Resume parsed with AI — all fields auto-filled. Review them below.'
        : 'Resume saved. Review the parsed fields below.';
      toast(msg, 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not save that resume.'), 'error');
    } finally {
      setFileStatus('idle');
    }
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  if (!active || isUploadingNew) {
    return (
      <>
        <PageHeader
          title={active ? 'Upload new resume' : 'Resume'}
          description="Upload your resume to start analyzing jobs and generating tailored applications."
          actions={
            active ? (
              <Button variant="ghost" onClick={() => setIsUploadingNew(false)}>
                Cancel
              </Button>
            ) : undefined
          }
        />

        <Card>
          <CardBody className="space-y-6">
            <div className="flex gap-2 border-b border-border pb-4">
              <button
                type="button"
                onClick={() => setTab('upload')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'upload' ? 'bg-brand-subtle text-brand' : 'text-fg-muted hover:bg-surface-muted hover:text-fg'}`}
              >
                Upload file
              </button>
              <button
                type="button"
                onClick={() => setTab('paste')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'paste' ? 'bg-brand-subtle text-brand' : 'text-fg-muted hover:bg-surface-muted hover:text-fg'}`}
              >
                Paste text
              </button>
            </div>

            {tab === 'upload' ? (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-8 py-14 transition-colors ${dragOver ? 'border-brand bg-brand-subtle/50' : 'border-border-strong hover:border-brand hover:bg-brand-subtle/20'}`}
                >
                  {fileStatus === 'idle' && !selectedFile ? (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-subtle">
                        <Upload className="h-6 w-6 text-brand" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-fg">Drop your resume here</p>
                        <p className="mt-1 text-xs text-fg-muted">
                          or click to browse — PDF, DOCX, or TXT
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge size="sm">PDF</Badge>
                        <Badge size="sm">DOCX</Badge>
                        <Badge size="sm">TXT</Badge>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Spinner className="h-8 w-8 text-brand" />
                      <p className="text-sm text-fg-muted">
                        {fileStatus === 'reading'
                          ? `Reading ${selectedFile?.name ?? 'file'}…`
                          : 'Parsing and saving…'}
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                    e.target.value = '';
                  }}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="resume-text">Resume text</Label>
                  <Textarea
                    id="resume-text"
                    rows={16}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="text-xs font-mono"
                    placeholder="Paste your full resume here…"
                  />
                </div>
                <Button
                  loading={fileStatus === 'uploading'}
                  disabled={text.trim().length < 100}
                  onClick={() => void uploadText()}
                >
                  <Plus className="h-4 w-4" /> Save resume
                </Button>
              </div>
            )}
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
        actions={
          <div className="flex items-center gap-3">
            {active.needsReview ? <Badge tone="warn">Needs review</Badge> : <Badge tone="strong">Reviewed</Badge>}
            <Button variant="outline" size="sm" onClick={() => setIsUploadingNew(true)}>
              Upload new
            </Button>
          </div>
        }
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
