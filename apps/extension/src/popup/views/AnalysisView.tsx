import { useState } from "react";
import type { JobAnalysis, JobPosting } from "@job-ai/types";
import {
  Alert,
  AtsPanel,
  Badge,
  Button,
  Card,
  CardBody,
  ScoreExplanation,
  ScoreRing,
  SkillMatchGroups,
  Tabs,
  TabPanel,
  bandFor,
  useToast,
} from "@job-ai/ui";
import {
  ArrowLeft,
  BookmarkPlus,
  FileEdit,
  Mail,
  MessageSquare,
} from "lucide-react";
import { MessageError, send } from "../../lib/messaging.ts";
import type { useJobFlow } from "../useJobFlow.ts";
import { TailorPanel } from "./TailorPanel.tsx";
import { CoverLetterPanel } from "./CoverLetterPanel.tsx";
import { InterviewPanel } from "./InterviewPanel.tsx";

type Panel = "tailor" | "cover-letter" | "interview" | null;

export function AnalysisView({
  flow,
  onOpenOptions,
}: {
  flow: ReturnType<typeof useJobFlow>;
  onOpenOptions: () => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [tab, setTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [tracked, setTracked] = useState(false);
  const { toast } = useToast();

  const { job, analysis, state } = flow;
  if (!job) return null;

  if (panel && analysis) {
    const back = (
      <button
        type="button"
        onClick={() => setPanel(null)}
        className="mb-3 flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to analysis
      </button>
    );
    return (
      <div>
        {back}
        {panel === "tailor" && <TailorPanel job={job} analysis={analysis} />}
        {panel === "cover-letter" && <CoverLetterPanel job={job} />}
        {panel === "interview" && <InterviewPanel job={job} />}
      </div>
    );
  }

  const saveJob = async (track: boolean) => {
    setSaving(true);
    try {
      const result = await send({
        type: "SAVE_JOB",
        payload: {
          job,
          track,
          ...(analysis ? { analysisId: analysis.id } : {}),
        },
      });
      setTracked(result.application !== null);
      toast(
        track ? "Added to your application tracker." : "Job saved.",
        "success",
      );
      void flow.refresh();
    } catch (err) {
      toast(
        err instanceof MessageError ? err.message : "Could not save this job.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <JobSummary job={job} />

      {!analysis ? (
        <div className="space-y-3">
          <Button block loading={false} onClick={() => void flow.analyze()}>
            Analyze my match
          </Button>
          {!state?.aiConfigured && (
            <Alert tone="neutral">
              No AI provider configured, so you&rsquo;ll get the local scoring
              analysis: match score, skill gaps and ATS coverage.{" "}
              <button
                type="button"
                className="underline"
                onClick={onOpenOptions}
              >
                Add a key
              </button>{" "}
              to also get tailoring, cover letters and interview prep.
            </Alert>
          )}
        </div>
      ) : (
        <>
          <ScoreCard analysis={analysis} />

          <Tabs
            size="sm"
            active={tab}
            onChange={setTab}
            items={[
              { id: "overview", label: "Overview" },
              { id: "skills", label: "Skills" },
              { id: "ats", label: "ATS" },
              { id: "why", label: "Why" },
            ]}
          />

          <div className="pt-1">
            <TabPanel id="overview" active={tab}>
              <OverviewPanel analysis={analysis} />
            </TabPanel>
            <TabPanel id="skills" active={tab}>
              <SkillMatchGroups skills={analysis.skills} />
            </TabPanel>
            <TabPanel id="ats" active={tab}>
              <AtsPanel analysis={analysis} />
            </TabPanel>
            <TabPanel id="why" active={tab}>
              <ScoreExplanation score={analysis.score} />
            </TabPanel>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <Button 
              block 
              variant="outline" 
              onClick={() => setPanel("tailor")}
              disabled={analysis.mode === "local"}
            >
              <FileEdit className="h-4 w-4" /> Tailor my resume
            </Button>
            <Button
              block
              variant="outline"
              onClick={() => setPanel("cover-letter")}
              disabled={analysis.mode === "local"}
            >
              <Mail className="h-4 w-4" /> Generate cover letter
            </Button>
            <Button
              block
              variant="outline"
              onClick={() => setPanel("interview")}
              disabled={analysis.mode === "local"}
            >
              <MessageSquare className="h-4 w-4" /> Prepare for interview
            </Button>
            <Button
              block
              loading={saving}
              disabled={tracked}
              onClick={() => void saveJob(true)}
            >
              <BookmarkPlus className="h-4 w-4" />
              {tracked ? "In your tracker" : "Save & track application"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function JobSummary({ job }: { job: JobPosting }) {
  const facts = [
    job.location,
    job.employmentType !== "unknown" ? job.employmentType : "",
    job.arrangement !== "unknown" ? job.arrangement : "",
    job.salary?.raw,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <h1 className="text-base leading-snug font-semibold text-fg">
        {job.title || "Untitled role"}
      </h1>
      <p className="text-sm text-fg-muted">
        {job.company || "Unknown company"}
      </p>
      {facts && <p className="mt-1 text-xs text-fg-subtle">{facts}</p>}
      <p className="mt-1.5 text-[10px] text-fg-subtle">
        Detected via {job.source.replace("-", " ")}
        {job.platform !== "generic" && ` · ${job.platform}`}
      </p>
    </div>
  );
}

function ScoreCard({ analysis }: { analysis: JobAnalysis }) {
  const band = bandFor(analysis.score.overall);
  const strong = analysis.skills.filter((s) => s.quality === "strong").length;
  const missing = analysis.skills.filter(
    (s) => s.quality === "missing" && s.required,
  ).length;

  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <ScoreRing score={analysis.score.overall} size={88} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={band.tone}>{band.label}</Badge>
            <Badge tone="neutral" size="sm">
              {analysis.mode === "ai-assisted"
                ? "AI-assisted"
                : analysis.mode === "mock"
                  ? "Demo data"
                  : "Local analysis"}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-fg-muted">
            {strong} skills matched · {missing} required{" "}
            {missing === 1 ? "gap" : "gaps"} · ATS {analysis.ats.coverage}%
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-fg-subtle">
            An estimate of resume-to-posting alignment, not a prediction of
            interview or hiring outcomes.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

function OverviewPanel({ analysis }: { analysis: JobAnalysis }) {
  const topRecs = analysis.recommendations.slice(0, 4);

  return (
    <div className="space-y-4">
      <section>
        <p className="text-xs font-medium text-fg">Experience</p>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">
          {analysis.experience.note}
        </p>
      </section>

      <section>
        <p className="text-xs font-medium text-fg">Education</p>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">
          {analysis.education.note}
        </p>
      </section>

      {analysis.concerns.length > 0 && (
        <section>
          <p className="text-xs font-medium text-fg">Gaps &amp; concerns</p>
          <ul className="mt-1.5 space-y-1.5">
            {analysis.concerns.slice(0, 5).map((c, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs leading-relaxed text-fg-muted"
              >
                <span
                  className={
                    c.severity === "high"
                      ? "text-danger"
                      : c.severity === "medium"
                        ? "text-warn"
                        : "text-fg-subtle"
                  }
                  aria-hidden="true"
                >
                  •
                </span>
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topRecs.length > 0 && (
        <section>
          <p className="text-xs font-medium text-fg">Recommended next steps</p>
          <div className="mt-1.5 space-y-2">
            {topRecs.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-border bg-surface p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-fg">{r.title}</p>
                  <Badge
                    size="sm"
                    tone={
                      r.priority === "high"
                        ? "danger"
                        : r.priority === "medium"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {r.priority}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                  {r.detail}
                </p>
                {r.needsUserConfirmation && (
                  <p className="mt-1.5 text-[10px] text-warn">
                    Needs your confirmation — only apply this if it is genuinely
                    true of your experience.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
