import { loadUserData } from '@/server/data';
import { ApplicationsTable } from './ApplicationsTable.tsx';

export const metadata = { title: 'Applications' };
export const dynamic = 'force-dynamic';

export default async function ApplicationsPage() {
  const { data } = await loadUserData();
  return (
    <ApplicationsTable
      initialApplications={[...data.applications].sort((a, b) =>
        b.discoveredAt.localeCompare(a.discoveredAt),
      )}
      versions={data.resumeVersions.map((v) => ({ id: v.id, name: v.name }))}
    />
  );
}
