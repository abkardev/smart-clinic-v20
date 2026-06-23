import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/health',
  '/api/whatsapp/webhook',      // Meta webhook — verified by WHATSAPP_VERIFY_TOKEN
  '/api/instagram/webhook',     // Meta webhook — verified by INSTAGRAM_VERIFY_TOKEN
  '/api/doctors',               // Public: booking widget reads doctor list
  '/api/bookings/available-slots',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/api/')) return NextResponse.next();
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next();

  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ') || auth.length < 20) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
