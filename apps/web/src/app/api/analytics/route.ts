import { computeAnalytics } from '@job-ai/core';
import { loadUserData } from '@/server/data';
import { ok, route } from '@/server/http';

export async function GET() {
  return route(async () => {
    const { data } = await loadUserData();
    const trackedJobIds = new Set(data.applications.map((a) => a.jobId));
    const savedOnly = data.jobs.filter((j) => !trackedJobIds.has(j.id)).length;
    return ok(computeAnalytics(data.applications, data.analyses, savedOnly));
  });
}
