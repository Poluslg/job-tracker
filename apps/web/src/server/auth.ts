import type { Session } from "@job-ai/types";
import { getSupabaseServerClient, isSupabaseConfigured } from "./supabase.ts";

export class UnauthorizedError extends Error {
  constructor(message = "You need to be signed in to do that.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

export function isAuthConfigured(): boolean {
  return isSupabaseConfigured();
}

export async function getAuthUser(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const meta = data.user.user_metadata ?? {};
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    name: (meta["full_name"] as string) || (meta["name"] as string) || "",
    avatarUrl: (meta["avatar_url"] as string) || "",
  };
}

export async function getSession(): Promise<Session | null> {
  const user = await getAuthUser();
  if (!user) return null;
  return {
    userId: user.id,
    email: user.email,
    name: user.name,

    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
}
