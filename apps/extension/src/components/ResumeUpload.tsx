import { useRef, useState } from 'react';
import { Alert, Button } from '@job-ai/ui';
import { FileText, Upload } from 'lucide-react';
import { ResumeFileError, extractResumeText } from '../lib/resumeFile.ts';
import { MessageError, send } from '../lib/messaging.ts';

export function ResumeUpload({
  onUploaded,
  currentLabel,
}: {
  onUploaded: (label: string) => void;
  currentLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasted, setPasted] = useState('');
  const [quality, setQuality] = useState<{ score: number; missing: string[] } | null>(null);
  const [savedLabel, setSavedLabel] = useState('');

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setQuality(null);
    try {
      const { text, type } = await extractResumeText(file);
      const result = await send({
        type: 'SAVE_RESUME',
        payload: { fileName: file.name, fileType: type, text, useAI: false },
      });

      // A partial parse is not a failure, but the user must be told which
      // fields to check rather than finding out during an analysis.
      if (result.quality.score < 85) {
        setQuality(result.quality);
        setSavedLabel(result.resume.label);
        return;
      }
      onUploaded(result.resume.label);
    } catch (err) {
      if (err instanceof ResumeFileError) setError({ message: err.message, hint: err.hint });
      else if (err instanceof MessageError) setError({ message: err.message, hint: '' });
      else setError({ message: 'Could not read that file.', hint: 'Try a PDF, DOCX or TXT file.' });
    } finally {
      setBusy(false);
    }
  };

  const savePasted = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await send({
        type: 'SAVE_RESUME',
        payload: { fileName: 'pasted-resume.txt', fileType: 'txt', text: pasted, useAI: false },
      });
      if (result.quality.score < 85) {
        setQuality(result.quality);
        setSavedLabel(result.resume.label);
        return;
      }
      onUploaded(result.resume.label);
    } catch (err) {
      setError({
        message: err instanceof MessageError ? err.message : 'Could not save that text.',
        hint: '',
      });
    } finally {
      setBusy(false);
    }
  };

  if (quality) {
    return (
      <div className="space-y-4">
        <Alert tone="warn" title={`Saved, but some fields didn't parse cleanly (${quality.score}% complete)`}>
          <p className="mt-1">
            Resume layouts vary a lot, so this is common. Your resume is saved — these fields need a
            quick check before the match score will be accurate:
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {quality.missing.map((field) => (
              <li key={field}>• {field}</li>
            ))}
          </ul>
        </Alert>

        <p className="text-xs leading-relaxed text-fg-muted">
          You can fix these in Settings → Resume. If the layout is unusual — multiple columns, tables,
          or graphics — pasting the plain text instead often parses much better.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onUploaded(savedLabel)}>Continue</Button>
          <Button
            variant="outline"
            onClick={() => {
              setQuality(null);
              setPasteMode(true);
            }}
          >
            Paste text instead
          </Button>
          <Button variant="ghost" onClick={() => setQuality(null)}>
            Try another file
          </Button>
        </div>
      </div>
    );
  }

  if (pasteMode) {
    return (
      <div className="space-y-3">
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={12}
          placeholder="Paste the full text of your resume here…"
          aria-label="Resume text"
          className="w-full rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed"
        />
        {error && <Alert tone="danger">{error.message}</Alert>}
        <div className="flex gap-2">
          <Button loading={busy} disabled={pasted.trim().length < 100} onClick={() => void savePasted()}>
            Save resume
          </Button>
          <Button variant="ghost" onClick={() => setPasteMode(false)}>
            Back to upload
          </Button>
        </div>
        {pasted.trim().length > 0 && pasted.trim().length < 100 && (
          <p className="text-xs text-fg-subtle">
            That&rsquo;s only {pasted.trim().length} characters — paste the whole resume.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? 'border-brand bg-brand-subtle' : 'border-border bg-surface'
        }`}
      >
        <FileText className="mx-auto h-8 w-8 text-fg-subtle" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium text-fg">
          {currentLabel ? `Current: ${currentLabel}` : 'Drop your resume here'}
        </p>
        <p className="mt-1 text-xs text-fg-muted">PDF, DOCX or TXT · up to 10 MB</p>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />

        <div className="mt-4 flex justify-center gap-2">
          <Button loading={busy} onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Choose file
          </Button>
          <Button variant="ghost" onClick={() => setPasteMode(true)}>
            Paste text instead
          </Button>
        </div>
      </div>

      {error && (
        <Alert tone="danger" title={error.message}>
          {error.hint}
        </Alert>
      )}

      <p className="text-xs leading-relaxed text-fg-subtle">
        Your resume is read in this browser and stored on this device. The file is never uploaded to
        us. Text is only sent to an AI provider when you run a feature that needs one, using your own
        API key.
      </p>
    </div>
  );
}
