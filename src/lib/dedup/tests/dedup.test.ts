import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock db ---
const mockExecute = vi.fn();
vi.mock('@/lib/db', () => ({
  getDb: vi.fn().mockResolvedValue({ execute: (...args: unknown[]) => mockExecute(...args) }),
}));

import { checkSameSourceDuplicate, findCrossSourceDuplicates } from '../index';
import type { TransactionInput, Transaction } from '@/types';

// --- Replicate stringSimilarity logic for testing ---
function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 100;

  const getBigrams = (s: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
  };

  const ba = getBigrams(la);
  const bb = getBigrams(lb);
  let intersection = 0;
  for (const b of ba) {
    if (bb.has(b)) intersection++;
  }
  const union = ba.size + bb.size - intersection;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

// --- Helper to build TransactionInput ---
function makeTxInput(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    source: 'alipay',
    date: '2024-01-15',
    amount: -50,
    type: 'expense',
    description: '美团外卖订单',
    ...overrides,
  };
}

// --- Helper to build Transaction (existing row) ---
function makeTxRow(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    source: 'wechat',
    source_id: null,
    date: '2024-01-15',
    time: null,
    amount: -50,
    type: 'expense',
    description: '美团外卖订单',
    counterparty: null,
    category_slug: 'food',
    payment_method: null,
    note: null,
    is_duplicate: false,
    duplicate_of: null,
    import_id: null,
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    ...overrides,
  };
}

// ========================================
// stringSimilarity tests (1–15)
// ========================================
describe('stringSimilarity', () => {
  it('1. 完全相同 → 100', () => {
    expect(stringSimilarity('hello', 'hello')).toBe(100);
  });

  it('2. 大小写不同 → 100', () => {
    expect(stringSimilarity('Hello', 'hello')).toBe(100);
  });

  it('3. a为空 → 0', () => {
    expect(stringSimilarity('', 'hello')).toBe(0);
  });

  it('4. b为空 → 0', () => {
    expect(stringSimilarity('hello', '')).toBe(0);
  });

  it('5. 都为空 → 0', () => {
    expect(stringSimilarity('', '')).toBe(0);
  });

  it('6. 单字符不同 → 0', () => {
    expect(stringSimilarity('a', 'b')).toBe(0);
  });

  it('7. 单字符相同 → 100', () => {
    expect(stringSimilarity('a', 'a')).toBe(100);
  });

  it('8. 双字符完全相同 → 100', () => {
    expect(stringSimilarity('ab', 'ab')).toBe(100);
  });

  it('9. 双字符完全不同 → 0', () => {
    expect(stringSimilarity('ab', 'cd')).toBe(0);
  });

  it('10. 部分重叠 → >0 且 <100', () => {
    const score = stringSimilarity('abcd', 'abef');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it('11. 对称性', () => {
    const s1 = stringSimilarity('abc', 'abcdef');
    const s2 = stringSimilarity('abcdef', 'abc');
    expect(s1).toBe(s2);
  });

  it('12. 中文高相似 → >=60', () => {
    expect(stringSimilarity('美团外卖订单', '美团外卖')).toBeGreaterThanOrEqual(60);
  });

  it('13. 中文低相似 → <30', () => {
    expect(stringSimilarity('美团外卖', '交通出行')).toBeLessThan(30);
  });

  it('14. 完全无交集长字符串 → 0', () => {
    expect(stringSimilarity('abcdef', 'xyzwvu')).toBe(0);
  });

  it('15. 重复字符 — Set去重后bigram', () => {
    // 'aaaa' bigrams: {'aa'} (size=1), 'aa' bigrams: {'aa'} (size=1)
    // intersection=1, union=1+1-1=1, score=100
    const score = stringSimilarity('aaaa', 'aa');
    // la !== lb so goes through bigram path
    // Both have only bigram 'aa', so intersection/union = 1/1 = 100
    expect(score).toBe(100);
  });
});

// ========================================
// checkSameSourceDuplicate tests (16–21)
// ========================================
describe('checkSameSourceDuplicate', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it('16. source_id 为 undefined → false，不查DB', async () => {
    const result = await checkSameSourceDuplicate(makeTxInput({ source_id: undefined }));
    expect(result).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('17. source_id 为 null → false', async () => {
    const result = await checkSameSourceDuplicate(makeTxInput({ source_id: null }));
    expect(result).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('18. source_id 为空字符串 → false', async () => {
    const result = await checkSameSourceDuplicate(makeTxInput({ source_id: '' }));
    expect(result).toBe(false);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('19. DB有匹配 → true', async () => {
    mockExecute.mockResolvedValue({ rows: [{ id: 1 }] });
    const result = await checkSameSourceDuplicate(makeTxInput({ source_id: 'tx_001' }));
    expect(result).toBe(true);
  });

  it('20. DB无匹配 → false', async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    const result = await checkSameSourceDuplicate(makeTxInput({ source_id: 'tx_002' }));
    expect(result).toBe(false);
  });

  it('21. SQL参数正确传递', async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    await checkSameSourceDuplicate(makeTxInput({ source: 'wechat', source_id: 'tx_003' }));
    expect(mockExecute).toHaveBeenCalledOnce();
    const call = mockExecute.mock.calls[0][0];
    expect(call.sql).toContain('SELECT id FROM transactions WHERE source = ? AND source_id = ?');
    expect(call.args).toEqual(['wechat', 'tx_003']);
  });
});

// ========================================
// findCrossSourceDuplicates tests (22–31)
// ========================================
describe('findCrossSourceDuplicates', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it('22. 金额+日期+描述高度相似 → 命中', async () => {
    mockExecute.mockResolvedValue({
      rows: [makeTxRow({ description: '美团外卖订单' })],
    });
    const results = await findCrossSourceDuplicates([
      makeTxInput({ description: '美团外卖订单' }),
    ]);
    expect(results.length).toBe(1);
    expect(results[0].similarity).toBeGreaterThanOrEqual(70);
  });

  it('23. 金额匹配但描述完全不同 → 不命中', async () => {
    mockExecute.mockResolvedValue({
      rows: [makeTxRow({ description: '交通出行地铁' })],
    });
    const results = await findCrossSourceDuplicates([
      makeTxInput({ description: '美团外卖订单' }),
    ]);
    expect(results.length).toBe(0);
  });

  it('24. DB无金额匹配 → 空结果', async () => {
    mockExecute.mockResolvedValue({ rows: [] });
    const results = await findCrossSourceDuplicates([makeTxInput()]);
    expect(results.length).toBe(0);
  });

  it('25. counterparty相似度更高 → 用cp的分数', async () => {
    mockExecute.mockResolvedValue({
      rows: [makeTxRow({ description: 'xxx', counterparty: '星巴克咖啡' })],
    });
    const results = await findCrossSourceDuplicates([
      makeTxInput({ description: 'yyy', counterparty: '星巴克咖啡' }),
    ]);
    expect(results.length).toBe(1);
    // description 'yyy' vs 'xxx' → 0, but counterparty identical → 100
    // Math.max(0, 100) = 100 >= 70
    expect(results[0].similarity).toBe(100);
  });

  it('26. 多条existing匹配 → 可能产生多个candidate', async () => {
    mockExecute.mockResolvedValue({
      rows: [
        makeTxRow({ id: 1, description: '美团外卖订单' }),
        makeTxRow({ id: 2, description: '美团外卖订单付款' }),
      ],
    });
    const results = await findCrossSourceDuplicates([
      makeTxInput({ description: '美团外卖订单' }),
    ]);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('27. 多条newTransaction → 逐条检查', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [makeTxRow({ description: '美团外卖订单' })] })
      .mockResolvedValueOnce({ rows: [makeTxRow({ id: 2, description: '滴滴出行' })] });
    const results = await findCrossSourceDuplicates([
      makeTxInput({ description: '美团外卖订单' }),
      makeTxInput({ description: '滴滴出行订单' }),
    ]);
    expect(mockExecute).toHaveBeenCalledTimes(2);
    // First should match (identical desc), second may or may not depending on similarity
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('28. 空输入 → 空结果', async () => {
    const results = await findCrossSourceDuplicates([]);
    expect(results).toEqual([]);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('29. amount取绝对值 → 负金额也能匹配', async () => {
    mockExecute.mockResolvedValue({
      rows: [makeTxRow({ amount: -99.99, description: '充值缴费' })],
    });
    const results = await findCrossSourceDuplicates([
      makeTxInput({ amount: -99.99, description: '充值缴费' }),
    ]);
    expect(results.length).toBe(1);
    // Verify the SQL args use absolute value
    const call = mockExecute.mock.calls[0][0];
    expect(call.args[0]).toBe(99.99);
  });

  it('30. 恰好70分 → 命中（边界）', async () => {
    // We need two strings whose stringSimilarity is exactly 70
    // Find a pair: 'abcdefghij' and 'abcdefgxyz'
    // Bigrams of 'abcdefghij': ab,bc,cd,de,ef,fg,gh,hi,ij (9)
    // Bigrams of 'abcdefgxyz': ab,bc,cd,de,ef,fg,gx,xy,yz (9)
    // intersection: ab,bc,cd,de,ef,fg = 6
    // union: 9+9-6 = 12
    // score: round(6/12*100) = 50 — not 70
    // Let's just mock the DB to return a row with the right description
    // and use a known pair that gives score=70
    // Try: 7 shared bigrams out of 10 union → 70
    // 'abcdefgh' bigrams: ab,bc,cd,de,ef,fg,gh (7)
    // 'abcdefghij' bigrams: ab,bc,cd,de,ef,fg,gh,hi,ij (9)
    // intersection=7, union=7+9-7=9, score=round(7/9*100)=78 — not 70
    // Alternative approach: use counterparty to control the score precisely
    // Actually, let's find exact: need round(intersection/union*100)=70
    // intersection/union = 0.7 → 7/10
    // 'abcdefghi' (8 bigrams: ab,bc,cd,de,ef,fg,gh,hi)
    // 'abcdefghixyz' (11 bigrams: ab,bc,cd,de,ef,fg,gh,hi,ix,xy,yz)
    // intersection=8, union=8+11-8=11, score=round(8/11*100)=73 — not 70
    // Let's try: need union=10, intersection=7
    // str1 with 8 bigrams, str2 with 9 bigrams, intersection=7 → union=8+9-7=10, score=70
    // 'abcdefghi' has bigrams: ab,bc,cd,de,ef,fg,gh,hi (8)
    // 'abcdefghxyz' has bigrams: ab,bc,cd,de,ef,fg,gh,hx,xy,yz (10) — wait that's 10 not 9
    // Let me count: a-b-c-d-e-f-g-h-x-y-z → ab,bc,cd,de,ef,fg,gh,hx,xy,yz (10 bigrams)
    // intersection with first: ab,bc,cd,de,ef,fg,gh = 7, union=8+10-7=11, score=round(7/11*100)=64
    // This is getting complex. Let me just use descriptions that produce exactly 70.
    // Simpler: mock existing row and use descriptions that we can verify produce score>=70
    // For boundary test, let's directly ensure the function includes score=70
    // Use identical descriptions so score=100 (which is >=70)
    // But we want to test the boundary. Let me use a workaround:
    // Mock the DB row with a specific description pair that gives ~70
    const desc = 'abcdefghijk';
    const existDesc = 'abcdefgmnop';
    const sim = stringSimilarity(desc, existDesc);
    // If sim >= 70, use as-is; if not, adjust. Let's check:
    // desc bigrams: ab,bc,cd,de,ef,fg,gh,hi,ij,jk (10)
    // existDesc bigrams: ab,bc,cd,de,ef,fg,gm,mn,no,op (10)
    // intersection: ab,bc,cd,de,ef,fg = 6, union=10+10-6=14, score=round(6/14*100)=43
    // Not enough. Let me just use a pair where I know the score.
    // For the boundary test, the key point is that score>=70 is included.
    // Let's use counterparty to push the score to exactly 70.
    // Actually, simplest: mock rows and use strings with known similarity.
    // 'abc' bigrams: ab,bc (2). 'abd' bigrams: ab,bd (2). intersection=1, union=3, score=33.
    // Let me just check the actual boundary: if score===70 it should be included.
    // Use description that we compute to give exactly 70:
    // Need round(i/u * 100) = 70. So i/u between 0.695 and 0.705.
    // 7/10=0.7 → 70. Need union=10, intersection=7.
    // str1 has n1 unique bigrams, str2 has n2, with 7 shared. n1+n2-7=10.
    // n1=8, n2=9: need str1 with 8 unique bigrams, str2 with 9, sharing 7.
    // str1='abcdefghi' → ab,bc,cd,de,ef,fg,gh,hi (8 unique bigrams)
    // str2='abcdefghixy' → ab,bc,cd,de,ef,fg,gh,hi,ix,xy (10 unique bigrams)
    // intersection=8, union=8+10-8=10, score=round(8/10*100)=80 — not 70
    // str2 with 9 bigrams, 7 shared with str1 (which has 8):
    // str1='abcdefghi' (8 bigrams)
    // Need str2 with 9 bigrams, 7 shared with str1.
    // Shared: ab,bc,cd,de,ef,fg,gh (7 of str1's 8). Not 'hi'.
    // str2 needs: ab,bc,cd,de,ef,fg,gh + 2 unique = 9 bigrams
    // str2='abcdefghxyz' → ab,bc,cd,de,ef,fg,gh,hx,xy,yz — that's 10 not 9
    // str2='abcdefghxy' → ab,bc,cd,de,ef,fg,gh,hx,xy — 9 bigrams, 7 shared (ab..gh)
    // intersection=7, union=8+9-7=10, score=round(7/10*100)=70. ✓
    const descA = 'abcdefghi';
    const descB = 'abcdefghxy';
    expect(stringSimilarity(descA, descB)).toBe(70); // verify

    mockExecute.mockResolvedValue({
      rows: [makeTxRow({ description: descB })],
    });
    const results = await findCrossSourceDuplicates([
      makeTxInput({ description: descA }),
    ]);
    expect(results.length).toBe(1);
    expect(results[0].similarity).toBe(70);
  });

  it('31. 69分 → 不命中', async () => {
    // Need round(i/u * 100) = 69. i/u between 0.685 and 0.695.
    // Try 9/13 = 0.6923 → round = 69. ✓
    // str1 with 10 bigrams, str2 with 12, intersection=9. union=10+12-9=13.
    // str1='abcdefghijk' → ab,bc,cd,de,ef,fg,gh,hi,ij,jk (10 bigrams)
    // shared 9: ab,bc,cd,de,ef,fg,gh,hi,ij (not jk)
    // str2 needs: ab,bc,cd,de,ef,fg,gh,hi,ij + 3 unique = 12 bigrams
    // str2='abcdefghijxyzw' → ab,bc,cd,de,ef,fg,gh,hi,ij,jx,xy,yz,zw (13 bigrams)
    // intersection with str1: ab,bc,cd,de,ef,fg,gh,hi,ij = 9
    // union=10+13-9=14, score=round(9/14*100)=64 — not 69

    // Try 11/16 = 0.6875 → round=69. ✓
    // Hmm getting complex. Let me try a different approach: just find a pair experimentally.
    // Actually 9/13=69.23→69. Need union=13, intersection=9.
    // n1+n2-9=13 → n1+n2=22.
    // n1=10, n2=12.
    // str1='abcdefghijk' (10 unique bigrams)
    // str2 shares 9 with str1 and has 3 unique: total 12 bigrams
    // Shared: ab,bc,cd,de,ef,fg,gh,hi,ij (9 of str1's 10, missing jk)
    // str2 unique: 3 new bigrams
    // str2='abcdefghijmnop' → ab,bc,cd,de,ef,fg,gh,hi,ij,jm,mn,no,op (13 bigrams) — too many
    // str2='abcdefghijmno' → ab,bc,cd,de,ef,fg,gh,hi,ij,jm,mn,no (12 bigrams)
    // intersection with str1: ab,bc,cd,de,ef,fg,gh,hi,ij = 9. ✓
    // union = 10+12-9 = 13. score = round(9/13*100) = round(69.23) = 69. ✓
    const descA = 'abcdefghijk';
    const descB = 'abcdefghijmno';
    expect(stringSimilarity(descA, descB)).toBe(69); // verify

    mockExecute.mockResolvedValue({
      rows: [makeTxRow({ description: descB })],
    });
    const results = await findCrossSourceDuplicates([
      makeTxInput({ description: descA }),
    ]);
    expect(results.length).toBe(0);
  });
});
