import { useCallback, useEffect, useState } from "react";
import type { Application, ApplicationStatus } from "@job-ai/types";
import { APPLICATION_STATUSES, STATUS_LABELS } from "@job-ai/types";
import { Button, EmptyState, Select, Skeleton, StatusBadge } from "@job-ai/ui";
import { Briefcase, Download, ExternalLink } from "lucide-react";
import { MessageError, send } from "../../lib/messaging.ts";
import { downloadDataUrl } from "../../lib/download.ts";

export function TrackerView({
  onError,
  onDone,
}: {
  onError: (message: string) => void;
  onDone: (message: string) => void;
}) {
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await send({ type: "LIST_APPLICATIONS" });
      setApplications(result.applications);
    } catch (err) {
      onError(
        err instanceof MessageError
          ? err.message
          : "Could not load your tracker.",
      );
      setApplications([]);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (id: string, status: ApplicationStatus) => {
    setBusyId(id);
    try {
      const result = await send({
        type: "UPDATE_APPLICATION",
        payload: { id, patch: { status } },
      });
      setApplications(
        (prev) =>
          prev?.map((a) => (a.id === id ? result.application : a)) ?? null,
      );
      onDone(`Moved to ${STATUS_LABELS[status]}.`);
    } catch (err) {
      onError(
        err instanceof MessageError
          ? err.message
          : "Could not update that application.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const exportTracker = async (format: "csv" | "xlsx") => {
    setExporting(true);
    try {
      const file = await send({ type: "EXPORT_TRACKER", payload: { format } });
      await downloadDataUrl(file.dataUrl, file.fileName);
      onDone(`Exported ${file.fileName}`);
    } catch (err) {
      onError(err instanceof MessageError ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  if (applications === null) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase className="h-8 w-8" strokeWidth={1.5} />}
        title="Your job application tracker is empty"
        description="Analyze a job posting and choose “Save & track application” to add your first one."
      />
    );
  }

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-fg-muted">
          {applications.length}{" "}
          {applications.length === 1 ? "application" : "applications"}
        </p>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            loading={exporting}
            onClick={() => void exportTracker("csv")}
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={exporting}
            onClick={() => void exportTracker("xlsx")}
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {applications.map((app) => (
          <li
            key={app.id}
            className="rounded-lg border border-border bg-surface p-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-fg">
                  {app.title || "Untitled role"}
                </p>
                <p className="truncate text-[11px] text-fg-muted">
                  {app.company}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {app.matchScore !== null && (
                  <span className="text-[11px] tabular-nums text-fg-muted">
                    {app.matchScore}
                  </span>
                )}
                <StatusBadge status={app.status} />
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Select
                aria-label={`Status for ${app.title} at ${app.company}`}
                value={app.status}
                disabled={busyId === app.id}
                onChange={(e) =>
                  void updateStatus(app.id, e.target.value as ApplicationStatus)
                }
                className="h-7 flex-1 text-[11px]"
              >
                {APPLICATION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
              {app.url && (
                <a
                  href={app.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="Open the original posting"
                  className="rounded-md p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {app.resumeVersionName && (
              <p className="mt-1.5 text-[10px] text-fg-subtle">
                Resume: {app.resumeVersionName}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
