import { loadUserData } from '@/server/data';
import { getSession } from '@/server/auth';
import { SettingsForm } from './SettingsForm.tsx';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [{ data }, session] = await Promise.all([loadUserData(), getSession()]);

  return (
    <SettingsForm
      
      initialSettings={{ ...data.settings, ai: { ...data.settings.ai, apiKey: '' } }}
      hasApiKey={data.settings.ai.apiKey.length > 0}
      email={session?.email ?? ''}
    />
  );
}
