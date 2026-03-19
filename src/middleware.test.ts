import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// --- Mock next/server ---
const mockNext = vi.fn().mockReturnValue({ type: 'next' });
const mockRedirect = vi.fn().mockImplementation((url: URL) => ({ type: 'redirect', url }));
vi.mock('next/server', () => ({
  NextResponse: { next: () => mockNext(), redirect: (url: URL) => mockRedirect(url) },
}));

import { middleware } from './middleware';
import type { NextRequest } from 'next/server';

function makeRequest(pathname: string, cookie?: { name: string; value: string }): NextRequest {
  const url = new URL(`http://localhost:3000${pathname}`);
  return {
    nextUrl: url,
    url: url.toString(),
    cookies: {
      get: (name: string) => {
        if (cookie && cookie.name === name) return { value: cookie.value };
        return undefined;
      },
    },
  } as unknown as NextRequest;
}

describe('middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    mockNext.mockClear();
    mockRedirect.mockClear();
    process.env = { ...originalEnv };
    delete process.env.APP_PASSWORD;
    mockNext.mockReturnValue({ type: 'next' });
    mockRedirect.mockImplementation((url: URL) => ({ type: 'redirect', url }));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('1. 未设置APP_PASSWORD → 放行', () => {
    const result = middleware(makeRequest('/anything'));
    expect(mockNext).toHaveBeenCalled();
    expect(result).toEqual({ type: 'next' });
  });

  it('2. Cookie正确 → next()', () => {
    process.env.APP_PASSWORD = 'secret123';
    const result = middleware(makeRequest('/dashboard', { name: 'moneylens_auth', value: 'secret123' }));
    expect(mockNext).toHaveBeenCalled();
    expect(result).toEqual({ type: 'next' });
  });

  it('3. Cookie错误 → redirect', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/dashboard', { name: 'moneylens_auth', value: 'wrong' }));
    expect(mockRedirect).toHaveBeenCalled();
  });

  it('4. 无Cookie → redirect', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/dashboard'));
    expect(mockRedirect).toHaveBeenCalled();
  });

  it('5. /login 精确匹配放行', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/login'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('6. /api/auth/login 精确匹配放行', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/api/auth/login'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('7. /_next/static/x.js 放行', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/_next/static/x.js'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('8. /_next/image/xx 放行', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/_next/image/xx'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('9. /icon.svg 放行', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/icon.svg'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('10. /favicon.ico 精确匹配放行', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/favicon.ico'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('11. /api/transactions 拦截', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/api/transactions'));
    expect(mockRedirect).toHaveBeenCalled();
  });

  it('12. /reports 拦截', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/reports'));
    expect(mockRedirect).toHaveBeenCalled();
  });

  it('13. / 根路径拦截', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/'));
    expect(mockRedirect).toHaveBeenCalled();
  });

  it('14. /api/categories 拦截', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/api/categories'));
    expect(mockRedirect).toHaveBeenCalled();
  });

  it('15. /login/extra 不放行', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/login/extra'));
    expect(mockRedirect).toHaveBeenCalled();
  });

  it('16. redirect URL包含 /login', () => {
    process.env.APP_PASSWORD = 'secret123';
    middleware(makeRequest('/dashboard'));
    expect(mockRedirect).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/login',
    }));
  });
});
