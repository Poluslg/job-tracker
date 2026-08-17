import { loadUserData } from '@/server/data';
import { Analyzer } from './Analyzer.tsx';

export const metadata = { title: 'Job Analyzer' };
export const dynamic = 'force-dynamic';

export default async function AnalyzerPage() {
  const { data } = await loadUserData();
  return (
    <Analyzer
      resumes={data.resumes.map((r) => ({ id: r.id, label: r.label, isDefault: r.isDefault }))}
      aiEnabled={data.settings.demoMode || data.settings.ai.apiKey.length > 0}
    />
  );
}
