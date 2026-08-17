'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Application, ApplicationStatus } from '@job-ai/types';
import { APPLICATION_STATUSES, STATUS_LABELS } from '@job-ai/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  StatusBadge,
  bandFor,
  useToast,
} from '@job-ai/ui';
import { Briefcase, Download, ExternalLink, Trash2 } from 'lucide-react';
import { del, errorMessage, patch } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

type SortKey = 'discoveredAt' | 'matchScore' | 'company' | 'status';

export function ApplicationsTable({
  initialApplications,
  versions,
}: {
  initialApplications: Application[];
  versions: Array<{ id: string; name: string }>;
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all');
  const [sort, setSort] = useState<SortKey>('discoveredAt');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = applications.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.company.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q) ||
        a.notes.toLowerCase().includes(q)
      );
    });

    return filtered.sort((a, b) => {
      switch (sort) {
        case 'matchScore':
          return (b.matchScore ?? -1) - (a.matchScore ?? -1);
        case 'company':
          return a.company.localeCompare(b.company);
        case 'status':
          return APPLICATION_STATUSES.indexOf(a.status) - APPLICATION_STATUSES.indexOf(b.status);
        default:
          return b.discoveredAt.localeCompare(a.discoveredAt);
      }
    });
  }, [applications, query, statusFilter, sort]);

  const update = async (id: string, body: Partial<Application>) => {
    setBusyId(id);
    
    const previous = applications;
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...body } : a)));
    try {
      const result = await patch<{ application: Application }>(`/api/applications/${id}`, body);
      setApplications((prev) => prev.map((a) => (a.id === id ? result.application : a)));
    } catch (err) {
      setApplications(previous);
      toast(errorMessage(err, 'Could not update that application.'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    try {
      await del(`/api/applications/${id}`);
      setApplications((prev) => prev.filter((a) => a.id !== id));
      setConfirmDelete(null);
      toast('Application deleted.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not delete that application.'), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title="Applications"
        description="Every job you're tracking, with the resume version you used."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => (window.location.href = '/api/export?format=csv')}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => (window.location.href = '/api/export?format=xlsx')}>
              <Download className="h-3.5 w-3.5" /> Excel
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company, title, notes…"
          aria-label="Search applications"
          className="max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | ApplicationStatus)}
          aria-label="Filter by status"
          className="max-w-40"
        >
          <option value="all">All statuses</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort applications"
          className="max-w-40"
        >
          <option value="discoveredAt">Newest first</option>
          <option value="matchScore">Match score</option>
          <option value="company">Company</option>
          <option value="status">Stage</option>
        </Select>
        <span className="ml-auto text-xs text-fg-muted">
          {visible.length} of {applications.length}
        </span>
      </div>

      {applications.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Briefcase className="h-8 w-8" strokeWidth={1.5} />}
            title="Your job application tracker is empty"
            description="Save a job from the Chrome extension, or analyze one here, to start tracking."
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState title="No applications match those filters" description="Try clearing the search or status filter." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {}
          <div className="overflow-x-auto">
            <table className="w-full min-w-4xl text-sm">
              <thead className="border-b border-border bg-surface-muted text-xs text-fg-muted">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Role</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Match</th>
                  <th className="px-4 py-2.5 text-left font-medium">Resume version</th>
                  <th className="px-4 py-2.5 text-left font-medium">Applied</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((app) => (
                  <tr key={app.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/dashboard/applications/${app.id}`} className="hover:underline">
                        <span className="block font-medium text-fg">{app.title || 'Untitled role'}</span>
                        <span className="block text-xs text-fg-muted">
                          {app.company}
                          {app.location && ` · ${app.location}`}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Select
                        value={app.status}
                        disabled={busyId === app.id}
                        aria-label={`Status for ${app.title} at ${app.company}`}
                        onChange={(e) => void update(app.id, { status: e.target.value as ApplicationStatus })}
                        className="h-8 w-40 text-xs"
                      >
                        {APPLICATION_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-2.5">
                      {app.matchScore === null ? (
                        <span className="text-xs text-fg-subtle">—</span>
                      ) : (
                        <Badge tone={bandFor(app.matchScore).tone}>{app.matchScore}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Select
                        value={app.resumeVersionId ?? ''}
                        disabled={busyId === app.id || versions.length === 0}
                        aria-label={`Resume version for ${app.title}`}
                        onChange={(e) => {
                          const version = versions.find((v) => v.id === e.target.value);
                          void update(app.id, {
                            resumeVersionId: version?.id ?? null,
                            resumeVersionName: version?.name ?? '',
                          });
                        }}
                        className="h-8 w-48 text-xs"
                      >
                        <option value="">Not recorded</option>
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap text-fg-muted">
                      {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {app.url && (
                          <a
                            href={app.url.startsWith('http') ? app.url : 'https://' + app.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label={`Open the original posting for ${app.title}`}
                            className="rounded-md p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {confirmDelete === app.id ? (
                          <span className="flex items-center gap-1">
                            <Button size="sm" variant="danger" onClick={() => void remove(app.id)}>
                              Delete
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                              Cancel
                            </Button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(app.id)}
                            aria-label={`Delete the application for ${app.title}`}
                            className="rounded-md p-1.5 text-fg-muted hover:bg-danger-subtle hover:text-danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
