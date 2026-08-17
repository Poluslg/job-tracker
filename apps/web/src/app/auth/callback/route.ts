import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/server/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requested = url.searchParams.get("next") ?? "/dashboard";

  const next = /^\/(?!\/)[\w\-/[\]]*$/.test(requested)
    ? requested
    : "/dashboard";

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing-code", url.origin),
    );
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL("/login?error=sign-in-failed", url.origin),
    );
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
