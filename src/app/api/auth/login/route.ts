import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const correct = process.env.APP_PASSWORD;

  if (!correct || password !== correct) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('moneylens_auth', password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  return response;
}
