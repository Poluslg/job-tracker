import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Skeleton } from '@job-ai/ui';
import { getSession } from '@/server/auth';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getSession()) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-fg">
            AI
          </span>
          <span className="text-base font-semibold">Career Copilot</span>
        </div>

        <h1 className="text-lg font-semibold">Sign in to your dashboard</h1>
        <p className="mt-1 mb-6 text-sm text-fg-muted">
          Sync your resume versions, tracker and analytics across devices.
        </p>

        {}
        <Suspense fallback={<Skeleton className="h-11 w-full" />}>
          <LoginForm />
        </Suspense>

        <p className="mt-8 text-xs leading-relaxed text-fg-subtle">
          An account is optional. The Chrome extension works fully in guest mode with everything
          stored on your own device — an account only adds cross-device sync and this dashboard.
        </p>
      </div>
    </main>
  );
}
