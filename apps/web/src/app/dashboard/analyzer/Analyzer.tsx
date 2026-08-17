"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { JobAnalysis, JobPosting } from "@job-ai/types";
import {
  Alert,
  AtsPanel,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Label,
  ScoreExplanation,
  ScoreRing,
  Select,
  SkillMatchGroups,
  Tabs,
  TabPanel,
  Textarea,
  bandFor,
  useToast,
} from "@job-ai/ui";
import { FileText, CheckCircle2 } from "lucide-react";
import { errorMessage, post } from "@/lib/api";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";

interface AnalyzeResponse {
  job: JobPosting;
  analysis: JobAnalysis;
  aiError: { code: string; message: string } | null;
}

const STAGES = [
  "Extracting requirements…",
  "Reading your resume…",
  "Comparing skills…",
  "Analyzing ATS coverage…",
  "Generating recommendations…",
];

function AnalyzerLoading() {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStage((prev) => Math.min(prev + 1, STAGES.length - 1));
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card>
      <CardBody className="space-y-6 py-8">
        <div className="flex justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
            <div className="absolute inset-0 rounded-full border-2 border-brand border-t-transparent animate-spin"></div>
            <FileText className="h-6 w-6 text-brand animate-pulse" />
          </div>
        </div>

        <div className="space-y-3 px-4">
          {STAGES.map((stage, i) => (
            <div
              key={stage}
              className={`flex items-center gap-3 transition-opacity duration-500 ${i <= currentStage ? "opacity-100" : "opacity-30"}`}
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                {i < currentStage ? (
                  <CheckCircle2 className="h-4 w-4 text-brand" />
                ) : i === currentStage ? (
                  <div className="h-4 w-4 rounded-full border-2 border-brand border-t-transparent animate-spin"></div>
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-border"></div>
                )}
              </div>
              <span
                className={`text-sm ${i === currentStage ? "text-fg font-medium animate-pulse" : "text-fg-muted"}`}
              >
                {stage}
              </span>
            </div>
          ))}
          <Alert className="mt-4" tone="neutral">
            AI can make mistakes. Check important info.
          </Alert>
        </div>
      </CardBody>
    </Card>
  );
}

export function Analyzer({
  resumes,
  aiEnabled,
}: {
  resumes: Array<{ id: string; label: string; isDefault: boolean }>;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [resumeId, setResumeId] = useState(
    resumes.find((r) => r.isDefault)?.id ?? resumes[0]?.id ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("skills");
  const [saving, setSaving] = useState(false);

  if (resumes.length === 0) {
    return (
      <>
        <PageHeader title="Job Analyzer" />
        <Card>
          <EmptyState
            icon={<FileText className="h-8 w-8" strokeWidth={1.5} />}
            title="Upload your resume to start analyzing jobs"
            description="Everything is compared against your resume, so that comes first."
            action={
              <LinkButton href="/dashboard/resume">Add your resume</LinkButton>
            }
          />
        </Card>
      </>
    );
  }

  const analyze = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await post<AnalyzeResponse>("/api/jobs/analyze", {
        job: { title, company, url, description },
        resumeId,
        useAI: aiEnabled,
      });
      setResult(response);
      if (response.aiError) {
        toast(`${response.aiError.message} Showing local analysis.`, "error");
      }
    } catch (err) {
      setError(errorMessage(err, "Analysis failed."));
    } finally {
      setBusy(false);
    }
  };

  const saveAndTrack = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await post("/api/applications", {
        jobId: result.job.id,
        analysisId: result.analysis.id,
      });
      toast("Added to your tracker.", "success");
      router.push("/dashboard/applications");
      router.refresh();
    } catch (err) {
      toast(errorMessage(err, "Could not save that job."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Job Analyzer"
        description="Paste a job description to see how your resume lines up. The extension does this automatically on any careers page."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="job-title">Job title</Label>
                <Input
                  id="job-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="url">Job URL (optional)</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            {resumes.length > 1 && (
              <div>
                <Label htmlFor="resume">Compare against</Label>
                <Select
                  id="resume"
                  value={resumeId}
                  onChange={(e) => setResumeId(e.target.value)}
                >
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="description">Job description</Label>
              <Textarea
                id="description"
                rows={16}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Paste the full posting, including requirements and responsibilities…"
                className="text-xs"
              />
              <p className="mt-1 text-[11px] text-fg-subtle">
                {description.length} characters
                {description.length > 0 &&
                  description.length < 400 &&
                  " — paste the whole posting for a reliable analysis."}
              </p>
            </div>

            {!aiEnabled && (
              <Alert tone="neutral">
                No AI provider configured. You&rsquo;ll still get the full local
                analysis — match score, skill gaps and ATS coverage.
              </Alert>
            )}
            {error && <Alert tone="danger">{error}</Alert>}

            <Button
              block
              loading={busy}
              disabled={description.trim().length < 100}
              onClick={() => void analyze()}
            >
              Analyze match
            </Button>
          </CardBody>
        </Card>

        <div>
          {busy && <AnalyzerLoading />}

          {!busy && !result && (
            <Card>
              <EmptyState
                title="No analysis yet"
                description="Paste a job description on the left and run the analysis to see your match score, skill gaps and ATS coverage."
              />
            </Card>
          )}

          {!busy && result && (
            <div className="space-y-4">
              <Card>
                <CardBody className="flex items-center gap-4">
                  <ScoreRing score={result.analysis.score.overall} />
                  <div className="min-w-0">
                    <Badge tone={bandFor(result.analysis.score.overall).tone}>
                      {bandFor(result.analysis.score.overall).label}
                    </Badge>
                    <p className="mt-2 text-xs text-fg-muted">
                      ATS coverage {result.analysis.ats.coverage}% ·{" "}
                      {
                        result.analysis.skills.filter(
                          (s) => s.quality === "missing" && s.required,
                        ).length
                      }{" "}
                      required gaps
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-fg-subtle">
                      An estimate of alignment, not a prediction of hiring
                      outcomes.
                    </p>
                  </div>
                </CardBody>
              </Card>

              <Tabs
                size="sm"
                active={tab}
                onChange={setTab}
                items={[
                  { id: "skills", label: "Skills" },
                  { id: "ats", label: "ATS" },
                  { id: "advice", label: "Advice" },
                  { id: "why", label: "Why" },
                ]}
              />

              <div>
                <TabPanel id="skills" active={tab}>
                  <SkillMatchGroups skills={result.analysis.skills} />
                </TabPanel>
                <TabPanel id="ats" active={tab}>
                  <AtsPanel analysis={result.analysis} />
                </TabPanel>
                <TabPanel id="advice" active={tab}>
                  <div className="space-y-2">
                    {result.analysis.recommendations.map((r) => (
                      <Card key={r.id}>
                        <CardBody>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium text-fg">
                              {r.title}
                            </p>
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
                              Needs your confirmation — only apply if it is
                              genuinely true of your experience.
                            </p>
                          )}
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </TabPanel>
                <TabPanel id="why" active={tab}>
                  <ScoreExplanation score={result.analysis.score} />
                </TabPanel>
              </div>

              <Button
                block
                loading={saving}
                onClick={() => void saveAndTrack()}
              >
                Save &amp; track this application
              </Button>
            </div>
          )}
          <Alert className="mt-4" tone="neutral">
            AI can make mistakes. Check important info.
          </Alert>
        </div>
      </div>
    </>
  );
}
