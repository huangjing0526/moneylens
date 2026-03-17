import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  // No password set = no protection (local dev)
  if (!password) return NextResponse.next();

  // Check cookie
  const authed = request.cookies.get('moneylens_auth')?.value;
  if (authed === password) return NextResponse.next();

  // Login API endpoint
  if (request.nextUrl.pathname === '/api/auth/login') return NextResponse.next();

  // Login page
  if (request.nextUrl.pathname === '/login') return NextResponse.next();

  // Static assets
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/icon') ||
    request.nextUrl.pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Redirect to login
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
