import { useState } from "react";
import type { CoverLetter, CoverLetterTone, JobPosting } from "@job-ai/types";
import {
  Alert,
  Button,
  Label,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "@job-ai/ui";
import { Copy, Download } from "lucide-react";
import {
  DOCX_MIME_TYPE,
  PDF_MIME_TYPE,
  buildDocx,
  buildPdf,
} from "@job-ai/core";
import { MessageError, send } from "../../lib/messaging.ts";
import { downloadBytes } from "../../lib/download.ts";

const TONES: Array<{ value: CoverLetterTone; label: string; hint: string }> = [
  {
    value: "professional",
    label: "Professional",
    hint: "Measured and standard — safe for most roles.",
  },
  {
    value: "concise",
    label: "Concise",
    hint: "Under 200 words. Two tight paragraphs.",
  },
  {
    value: "enthusiastic",
    label: "Enthusiastic",
    hint: "Energy grounded in specifics from the posting.",
  },
  {
    value: "technical",
    label: "Technical",
    hint: "Leads with systems, decisions and trade-offs.",
  },
  {
    value: "startup",
    label: "Startup-focused",
    hint: "Direct, ownership-forward, low ceremony.",
  },
  {
    value: "corporate",
    label: "Corporate",
    hint: "Formal register, explicit alignment to requirements.",
  },
];

export function CoverLetterPanel({ job }: { job: JobPosting }) {
  const [tone, setTone] = useState<CoverLetterTone>("professional");
  const [extraContext, setExtraContext] = useState("");
  const [letter, setLetter] = useState<CoverLetter | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await send({
        type: "GENERATE_COVER_LETTER",
        payload: { jobId: job.id, tone, extraContext },
      });
      setLetter(result.coverLetter);
      setBody(result.coverLetter.body);
    } catch (err) {
      setError(
        err instanceof MessageError
          ? err.message
          : "Could not generate a cover letter.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fileBase = `cover-letter-${(job.company || "company").replace(/[^\w-]/g, "-").toLowerCase()}`;

  const download = async (format: "pdf" | "docx") => {
    const blocks = body
      .split(/\n{2,}/)
      .map((p) => ({ type: "paragraph" as const, text: p.trim() }));
    if (format === "docx") {
      await downloadBytes(
        buildDocx(blocks),
        `${fileBase}.docx`,
        DOCX_MIME_TYPE,
      );
    } else {
      await downloadBytes(
        buildPdf(blocks, "Cover letter"),
        `${fileBase}.pdf`,
        PDF_MIME_TYPE,
      );
    }
    toast(`Downloaded ${fileBase}.${format}`, "success");
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-fg-muted">Drafting your cover letter…</p>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!letter) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Generate cover letter</h2>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            Written from your actual resume and this posting. Every claim traces
            back to something you already wrote.
          </p>
        </div>

        <div>
          <Label htmlFor="tone">Tone</Label>
          <Select
            id="tone"
            value={tone}
            onChange={(e) => setTone(e.target.value as CoverLetterTone)}
          >
            {TONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-[11px] text-fg-subtle">
            {TONES.find((t) => t.value === tone)?.hint}
          </p>
        </div>

        <div>
          <Label htmlFor="context">Anything to add? (optional)</Label>
          <Textarea
            id="context"
            rows={3}
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            maxLength={2000}
            placeholder="A referral, why this company specifically, a detail not on your resume…"
          />
        </div>

        {error && <Alert tone="danger">{error}</Alert>}

        <Button block onClick={() => void generate()}>
          Generate
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Your draft</h2>
        <button
          type="button"
          className="text-xs text-fg-muted underline"
          onClick={() => setLetter(null)}
        >
          Start over
        </button>
      </div>

      <Textarea
        rows={16}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Cover letter body"
        className="text-[11px] leading-relaxed"
      />

      {letter.needsConfirmation.length > 0 && (
        <Alert tone="warn" title="Check before sending">
          <ul className="mt-1 space-y-1">
            {letter.needsConfirmation.map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button
          block
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(body);
            toast("Copied to clipboard.", "success");
          }}
        >
          <Copy className="h-4 w-4" /> Copy
        </Button>
        <Button block variant="outline" onClick={() => void download("pdf")}>
          <Download className="h-4 w-4" /> PDF
        </Button>
        <Button block variant="outline" onClick={() => void download("docx")}>
          <Download className="h-4 w-4" /> DOCX
        </Button>
      </div>
    </div>
  );
}
