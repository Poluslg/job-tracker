import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { AIError } from '@job-ai/types';
import { UnauthorizedError } from './auth.ts';

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(
  code: string,
  message: string,
  status = 400,
  fields?: Record<string, string>,
): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message, ...(fields ? { fields } : {}) } }, { status });
}

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<
  | { ok: true; data: z.infer<T>; present: <D extends object>(parsed: D) => Partial<D> }
  | { ok: false; response: NextResponse }
> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) {
    return { ok: false, response: fail('too-large', 'That request body is too large.', 413) };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: fail('invalid-json', 'The request body was not valid JSON.', 400) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join('.') || 'body'] = issue.message;
    }
    return {
      ok: false,
      response: fail('validation', 'Some fields were invalid.', 422, fields),
    };
  }

  const sentKeys = new Set(
    raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.keys(raw) : [],
  );

  return {
    ok: true,
    data: parsed.data,
    
    present<D extends object>(parsedObject: D): Partial<D> {
      const out: Partial<D> = {};
      for (const key of Object.keys(parsedObject) as Array<keyof D & string>) {
        if (sentKeys.has(key)) out[key] = parsedObject[key];
      }
      return out;
    },
  };
}

export function route<T extends Response = NextResponse>(
  handler: () => Promise<T>,
): Promise<T | NextResponse> {
  return handler().catch((err: unknown) => {
    if (err instanceof UnauthorizedError) return fail('unauthorized', err.message, 401);
    if (err instanceof AIError) return fail(err.code, err.message, err.code === 'no-key' ? 400 : 502);
    console.error('[api] unhandled error', err);
    return fail('internal', 'Something went wrong on our side. Please try again.', 500);
  });
}

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (bucket.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { allowed: true, retryAfter: 0 };
}

export function tooManyRequests(retryAfter: number): NextResponse {
  const response = fail('rate-limited', `Too many attempts. Try again in ${retryAfter}s.`, 429);
  response.headers.set('Retry-After', String(retryAfter));
  return response;
}

export function clientKey(request: Request, suffix: string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${forwarded ?? 'local'}:${suffix}`;
}
