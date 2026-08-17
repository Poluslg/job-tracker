import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseMiddlewareClient, isSupabaseConfigured } from './server/supabase';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  try {
    const supabase = getSupabaseMiddlewareClient(request, response);
    
    await supabase.auth.getUser();
  } catch {

  }

  return response;
}

export const config = {
  matcher: [
    
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
