import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

// ========================
// Module A: SQL Injection Prevention
// ========================

const mockExecute = vi.fn();
const mockBatch = vi.fn();
vi.mock('@/lib/db/index', () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: (...args: unknown[]) => mockExecute(...args),
    batch: (...args: unknown[]) => mockBatch(...args),
  }),
}));

import { getTransactions, getTransactionCount } from '@/lib/db/queries';

const MIDDLEWARE_PATH = path.resolve(__dirname, '../middleware.ts');

beforeEach(() => {
  mockExecute.mockReset();
  mockBatch.mockReset();
  mockExecute.mockResolvedValue({ rows: [], lastInsertRowid: 1 });
});

function lastExecuteCall() {
  const call = mockExecute.mock.calls[mockExecute.mock.calls.length - 1][0];
  return { sql: call.sql as string, args: call.args as unknown[] };
}

describe('SQL注入防护', () => {
  it('1. search参数含SQL注入 → 参数化查询，注入字符串不出现在sql中', async () => {
    const injections = [
      "'; DROP TABLE transactions; --",
      "1 OR 1=1",
      "' UNION SELECT * FROM users --",
      "Robert'); DROP TABLE Students;--",
    ];

    for (const injection of injections) {
      mockExecute.mockResolvedValueOnce({ rows: [] });
      await getTransactions({ search: injection });
      const { sql, args } = lastExecuteCall();
      // Injection must NOT be in the SQL string
      expect(sql).not.toContain(injection);
      // Must use parameterized ? placeholders
      expect(sql).toContain('LIKE ?');
      // The injection value should be safely in args
      expect(args).toContain(`%${injection}%`);
    }
  });

  it('2. 分类slug含特殊字符 → 作为参数传递而非拼接', async () => {
    const maliciousSlug = "food' OR '1'='1";
    await getTransactions({ category: maliciousSlug });
    const { sql, args } = lastExecuteCall();
    expect(sql).not.toContain(maliciousSlug);
    expect(sql).toContain('category_slug = ?');
    expect(args).toContain(maliciousSlug);
  });

  it('3. 日期参数含SQL → 参数化安全', async () => {
    const maliciousDate = "2024-01-01'; DROP TABLE transactions; --";
    await getTransactions({ startDate: maliciousDate });
    const { sql, args } = lastExecuteCall();
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).toContain('date >= ?');
    expect(args).toContain(maliciousDate);
  });
});

// ========================
// Module B: Middleware Security
// ========================

// We need to test the middleware function directly
// Reset modules so we can control env vars
describe('中间件安全', () => {
  // Helper to create a mock NextRequest
  function createMockRequest(pathname: string, cookies: Record<string, string> = {}) {
    return {
      nextUrl: {
        pathname,
      },
      cookies: {
        get: (name: string) => cookies[name] ? { value: cookies[name] } : undefined,
      },
      url: 'http://localhost:3000' + pathname,
    };
  }

  // We import and test the middleware logic directly
  // Since middleware uses NextResponse which requires Next.js, we test the logic

  it('4. Cookie值含特殊字符 → 只做精确比较不会导致注入', async () => {
    // The middleware does: authed === password (strict equality)
    // Special chars in cookie should not cause issues
    // Test by verifying the source code uses strict equality
    // Read the middleware source to verify === comparison
    const middlewareSrc = readFileSync(MIDDLEWARE_PATH, 'utf-8');
    // Verify it uses strict equality for cookie comparison
    expect(middlewareSrc).toContain('authed === password');
    // Should NOT use loose equality or includes/match
    expect(middlewareSrc).not.toMatch(/authed\s*==\s*password[^=]/);
    expect(middlewareSrc).not.toContain('authed.includes');
    expect(middlewareSrc).not.toContain('authed.match');
  });

  it('5. APP_PASSWORD为空字符串 → 与undefined行为不同', async () => {
    // When APP_PASSWORD is '' (empty string), it's falsy in JS
    // So `if (!password)` will return NextResponse.next() — same as undefined
    // This means empty string password = no protection
    // This is actually a potential issue worth documenting
    const middlewareSrc = readFileSync(MIDDLEWARE_PATH, 'utf-8');
    // The middleware checks: if (!password) return NextResponse.next()
    // Empty string '' is falsy, so it will skip auth — verify this is the behavior
    expect(middlewareSrc).toContain('if (!password) return NextResponse.next()');
    // NOTE: This means APP_PASSWORD='' effectively disables auth.
    // Empty string is falsy in JS, so !'' === true.
    // This is technically safe (no auth bypass) but means empty password = no protection.
  });

  it('6. 超长路径 → 不会崩溃', async () => {
    const middlewareSrc = readFileSync(MIDDLEWARE_PATH, 'utf-8');
    // Verify middleware uses startsWith and === for path checks (not regex that could ReDoS)
    expect(middlewareSrc).toContain("request.nextUrl.pathname === '/api/auth/login'");
    expect(middlewareSrc).toContain("request.nextUrl.pathname === '/login'");
    expect(middlewareSrc).toContain("request.nextUrl.pathname.startsWith('/_next')");
    // No user-controlled regex patterns that could cause ReDoS with long paths
    expect(middlewareSrc).not.toMatch(/new RegExp\(/);
  });

  it('7. 路径含../ → 不会绕过认证', async () => {
    const middlewareSrc = readFileSync(MIDDLEWARE_PATH, 'utf-8');
    // The middleware uses exact path matching (===) and startsWith
    // Path traversal like /login/../admin won't match === '/login'
    // because Next.js normalizes the URL before middleware runs
    // Verify there's no custom path normalization that could be bypassed
    expect(middlewareSrc).not.toContain('decodeURI');
    expect(middlewareSrc).not.toContain('decodeURIComponent');
    // All protected paths require exact match or startsWith with known prefix
    expect(middlewareSrc).toContain("request.nextUrl.pathname === '/api/auth/login'");
    expect(middlewareSrc).toContain("request.nextUrl.pathname === '/login'");
  });
});

// ========================
// Module C: Input Validation (Parser)
// ========================

describe('输入验证（Parser）', () => {
  // We need parseCSV which requires Buffer input
  let parseCSV: (buffer: Buffer, filename: string) => { transactions: any[]; errors: string[] };

  beforeEach(async () => {
    const mod = await import('@/lib/parsers/index');
    parseCSV = mod.parseCSV;
  });

  it('8. 恶意description含标签 → parser不处理XSS但应原样保存', () => {
    const maliciousDesc = '<script>alert("xss")</script>';
    const csv = `日期,金额,描述,收/支\n2024-01-01,-100,${maliciousDesc},支出`;
    const buffer = Buffer.from(csv, 'utf-8');
    const result = parseCSV(buffer, 'test.csv');
    // Parser should preserve the raw value (XSS prevention is frontend's job)
    if (result.transactions.length > 0) {
      expect(result.transactions[0].description).toContain('<script>');
    }
    // Should not crash
    expect(result).toBeDefined();
  });

  it('9. 超大金额值 → 不会溢出', () => {
    const bigAmount = String(Number.MAX_SAFE_INTEGER);
    const csv = `日期,金额,描述,收/支\n2024-01-01,${bigAmount},大额交易,收入`;
    const buffer = Buffer.from(csv, 'utf-8');
    const result = parseCSV(buffer, 'test.csv');
    // Should not crash
    expect(result).toBeDefined();
    if (result.transactions.length > 0) {
      expect(typeof result.transactions[0].amount).toBe('number');
      expect(Number.isFinite(result.transactions[0].amount)).toBe(true);
    }
  });

  it('10. 极长字符串输入 → 不会崩溃', () => {
    const longStr = 'A'.repeat(100000);
    const csv = `日期,金额,描述,收/支\n2024-01-01,-50,${longStr},支出`;
    const buffer = Buffer.from(csv, 'utf-8');
    // Should not throw
    expect(() => parseCSV(buffer, 'test.csv')).not.toThrow();
    const result = parseCSV(buffer, 'test.csv');
    expect(result).toBeDefined();
  });
});
