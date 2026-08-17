"use client";

import type { ApiError } from "@job-ai/types";

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(error: ApiError, status: number) {
    super(error.message);
    this.name = "ApiRequestError";
    this.code = error.code;
    this.status = status;
    this.fields = error.fields ?? {};
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },

      credentials: "same-origin",
    });
  } catch {
    throw new ApiRequestError(
      {
        code: "network",
        message: "Could not reach the server. Check your connection.",
      },
      0,
    );
  }

  if (response.status === 401) {
    throw new ApiRequestError(
      { code: "unauthorized", message: "Please sign in again." },
      401,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiRequestError(
      {
        code: "invalid-response",
        message: "The server returned an unexpected response.",
      },
      response.status,
    );
  }

  const envelope = payload as { ok?: boolean; data?: T; error?: ApiError };
  if (!envelope.ok || envelope.data === undefined) {
    throw new ApiRequestError(
      envelope.error ?? { code: "unknown", message: "Something went wrong." },
      response.status,
    );
  }
  return envelope.data;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" });

export function errorMessage(
  err: unknown,
  fallback = "Something went wrong.",
): string {
  return err instanceof ApiRequestError ? err.message : fallback;
}
