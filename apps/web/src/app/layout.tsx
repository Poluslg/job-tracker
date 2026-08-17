import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { ToastProvider } from '@job-ai/ui';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AI Career Copilot',
    template: '%s · AI Career Copilot',
  },
  description:
    'Understand how your resume matches a job, tailor it honestly, prepare for interviews and track every application.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#16181d' },
  ],
};

export const THEME_COOKIE = 'jobai-theme';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  const themeClass = theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : '';

  return (
    <html lang="en" className={themeClass}>
      <body className="min-h-screen bg-bg text-fg antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
