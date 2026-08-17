'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button } from '@job-ai/ui';
import { getSupabaseBrowserClient, isAuthConfiguredInBrowser } from '@/lib/supabaseClient';

const ERROR_COPY: Record<string, string> = {
  'missing-code': 'Google did not return a sign-in code. Please try again.',
  'sign-in-failed': 'We could not complete that sign-in. Please try again.',
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(ERROR_COPY[params.get('error') ?? ''] ?? null);

  const configured = isAuthConfiguredInBrowser();

  const signInWithGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,

          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (oauthError) throw oauthError;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in.');
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <div className="space-y-4">
        <Alert tone="warn" title="Google sign-in is not configured">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{' '}
          <code>apps/web/.env.local</code>, then enable the Google provider in your Supabase project.
          See <code>docs/setup-supabase.md</code>.
        </Alert>
        <Button
          block
          variant="outline"
          onClick={() => {
            router.push('/dashboard');
            router.refresh();
          }}
        >
          Continue in local development mode
        </Button>
        <p className="text-center text-xs text-fg-subtle">
          Development only — uses the local JSON store and a fixed local identity.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button block size="lg" loading={busy} onClick={() => void signInWithGoogle()}>
        <GoogleMark />
        Continue with Google
      </Button>

      {error && <Alert tone="danger">{error}</Alert>}

      <p className="text-center text-xs leading-relaxed text-fg-subtle">
        Google is used only to sign you in. The extension never posts anything on your behalf, and
        this app does not request access to your Gmail, Drive or contacts.
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.5 5.5 0 0 1-2.4 3.62v3h3.87c2.26-2.09 3.59-5.17 3.59-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.28a12 12 0 0 0 0 10.74l3.99-3.09z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.63l3.99 3.09C6.22 6.87 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
