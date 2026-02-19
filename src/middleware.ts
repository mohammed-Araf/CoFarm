import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check for Supabase auth token in cookies
  const token = request.cookies.get('sb-falpfucnwaldjckggrtc-auth-token');
  const isAuthPage = request.nextUrl.pathname === '/login';
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/nodes');

  // If trying to access login while already authenticated, redirect to dashboard
  // Note: This is a light check; real auth validation happens client-side
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/nodes/:path*', '/login'],
};
