import type { Application } from '@job-ai/types';
import { STATUS_LABELS } from '@job-ai/types';
import { buildCsv, CSV_MIME_TYPE, type CsvValue } from './csv.ts';
import { buildXlsx, XLSX_MIME_TYPE, type CellValue, type SheetSpec } from './xlsx.ts';

export interface TrackerColumn {
  header: string;
  width: number;
  value: (app: Application) => CsvValue;
}

function date(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export const TRACKER_COLUMNS: TrackerColumn[] = [
  { header: 'Company', width: 24, value: (a) => a.company },
  { header: 'Job Title', width: 30, value: (a) => a.title },
  { header: 'Status', width: 18, value: (a) => STATUS_LABELS[a.status] },
  { header: 'Match Score', width: 13, value: (a) => a.matchScore ?? '' },
  { header: 'Location', width: 22, value: (a) => a.location },
  { header: 'Job Type', width: 14, value: (a) => a.jobType },
  { header: 'Salary', width: 20, value: (a) => a.salary },
  { header: 'Date Saved', width: 13, value: (a) => date(a.discoveredAt) },
  { header: 'Date Applied', width: 13, value: (a) => date(a.appliedAt) },
  { header: 'Resume Version', width: 26, value: (a) => a.resumeVersionName },
  { header: 'Recruiter', width: 20, value: (a) => a.recruiter.name },
  { header: 'Recruiter Email', width: 26, value: (a) => a.recruiter.email },
  { header: 'Interview Date', width: 15, value: (a) => date(a.nextInterviewAt) },
  { header: 'Follow-up Date', width: 15, value: (a) => date(a.followUpAt) },
  { header: 'URL', width: 42, value: (a) => a.url },
  { header: 'Notes', width: 50, value: (a) => a.notes },
];

export interface ExportFile {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

function fileStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function exportTrackerCsv(applications: Application[]): ExportFile {
  const csv = buildCsv(
    TRACKER_COLUMNS.map((c) => c.header),
    applications.map((a) => TRACKER_COLUMNS.map((c) => c.value(a))),
  );
  return {
    fileName: `job-applications-${fileStamp()}.csv`,
    mimeType: CSV_MIME_TYPE,
    bytes: new TextEncoder().encode(csv),
  };
}

export function exportTrackerXlsx(applications: Application[]): ExportFile {
  const tracker: SheetSpec = {
    name: 'Applications',
    columns: TRACKER_COLUMNS.map((c) => ({ header: c.header, width: c.width })),
    rows: applications.map((a) =>
      TRACKER_COLUMNS.map((c) => {
        const v = c.value(a);
        return v === undefined ? null : v;
      }),
    ),
  };

  const byStatus = new Map<string, number>();
  for (const a of applications) {
    const label = STATUS_LABELS[a.status];
    byStatus.set(label, (byStatus.get(label) ?? 0) + 1);
  }
  const scores = applications.map((a) => a.matchScore).filter((s): s is number => s !== null);
  const avg = scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null;

  const summary: SheetSpec = {
    name: 'Summary',
    columns: [
      { header: 'Metric', width: 30 },
      { header: 'Value', width: 18 },
    ],
    rows: [
      ['Total applications', applications.length],
      ['Average match score', avg ?? ''],
      ['Exported', new Date().toISOString().slice(0, 16).replace('T', ' ')],
      ['', ''],
      ['By status', ''],
      ...[...byStatus.entries()].map(([k, v]): CellValue[] => [k, v]),
    ],
  };

  return {
    fileName: `job-applications-${fileStamp()}.xlsx`,
    mimeType: XLSX_MIME_TYPE,
    bytes: buildXlsx([tracker, summary]),
  };
}

export function exportTracker(applications: Application[], format: 'csv' | 'xlsx'): ExportFile {
  return format === 'csv' ? exportTrackerCsv(applications) : exportTrackerXlsx(applications);
}

export function toDataUrl(file: ExportFile): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < file.bytes.length; i += chunk) {
    binary += String.fromCharCode(...file.bytes.subarray(i, i + chunk));
  }
  return `data:${file.mimeType};base64,${btoa(binary)}`;
}
