import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock setup - must be before imports
const mockExecute = vi.fn();
const mockBatch = vi.fn();
vi.mock('../index', () => ({
  getDb: vi.fn().mockResolvedValue({
    execute: (...args: unknown[]) => mockExecute(...args),
    batch: (...args: unknown[]) => mockBatch(...args),
  }),
}));

import {
  getTransactions,
  getTransactionById,
  insertTransactions,
  updateTransaction,
  deleteTransaction,
  getTransactionCount,
  getMonthlySummary,
  addCategoryRule,
} from '../queries';

// Helper to extract the sql/args from the last mockExecute call
function lastExecuteCall() {
  const call = mockExecute.mock.calls[mockExecute.mock.calls.length - 1][0];
  return { sql: call.sql as string, args: call.args as unknown[] };
}

beforeEach(() => {
  mockExecute.mockReset();
  mockBatch.mockReset();
  mockExecute.mockResolvedValue({ rows: [], lastInsertRowid: 1 });
  mockBatch.mockResolvedValue([]);
});

// ========================
// getTransactions (12 cases)
// ========================
describe('getTransactions', () => {
  it('1. 无过滤器 → SQL只含 WHERE is_duplicate = 0', async () => {
    await getTransactions();
    const { sql } = lastExecuteCall();
    expect(sql).toContain('WHERE is_duplicate = 0');
    // Should not contain other filter conditions
    expect(sql).not.toContain('date >=');
    expect(sql).not.toContain('date <=');
    expect(sql).not.toContain('category_slug');
    expect(sql).not.toContain('LIKE');
  });

  it('2. startDate → 添加 date >= ?', async () => {
    await getTransactions({ startDate: '2024-01-01' });
    const { sql, args } = lastExecuteCall();
    expect(sql).toContain('date >= ?');
    expect(args).toContain('2024-01-01');
  });

  it('3. endDate → 添加 date <= ?', async () => {
    await getTransactions({ endDate: '2024-12-31' });
    const { sql, args } = lastExecuteCall();
    expect(sql).toContain('date <= ?');
    expect(args).toContain('2024-12-31');
  });

  it('4. category → 添加 category_slug = ?', async () => {
    await getTransactions({ category: 'food' });
    const { sql, args } = lastExecuteCall();
    expect(sql).toContain('category_slug = ?');
    expect(args).toContain('food');
  });

  it('5. type=income → 添加 type = ?', async () => {
    await getTransactions({ type: 'income' });
    const { sql, args } = lastExecuteCall();
    expect(sql).toContain('type = ?');
    expect(args).toContain('income');
  });

  it('6. search → 添加 (description LIKE ? OR counterparty LIKE ?)，参数用 %keyword%', async () => {
    await getTransactions({ search: 'coffee' });
    const { sql, args } = lastExecuteCall();
    expect(sql).toContain('description LIKE ?');
    expect(sql).toContain('counterparty LIKE ?');
    expect(args).toContain('%coffee%');
    // Should have two %coffee% params (one for description, one for counterparty)
    expect(args.filter(a => a === '%coffee%')).toHaveLength(2);
  });

  it('7. limit → SQL含 LIMIT', async () => {
    await getTransactions({ limit: 10 });
    const { sql } = lastExecuteCall();
    expect(sql).toContain('LIMIT 10');
  });

  it('8. offset → SQL含 OFFSET', async () => {
    await getTransactions({ offset: 20 });
    const { sql } = lastExecuteCall();
    expect(sql).toContain('OFFSET 20');
  });

  it('9. 全部过滤器组合 → 所有条件 AND 拼接', async () => {
    await getTransactions({
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      category: 'food',
      type: 'expense',
      search: 'lunch',
      limit: 50,
      offset: 10,
    });
    const { sql, args } = lastExecuteCall();
    expect(sql).toContain('is_duplicate = 0');
    expect(sql).toContain('date >= ?');
    expect(sql).toContain('date <= ?');
    expect(sql).toContain('category_slug = ?');
    expect(sql).toContain('type = ?');
    expect(sql).toContain('description LIKE ?');
    expect(sql).toContain('counterparty LIKE ?');
    expect(sql).toContain('LIMIT 50');
    expect(sql).toContain('OFFSET 10');
    // All conditions joined by AND
    expect(sql).toMatch(/WHERE .+ AND .+ AND .+ AND .+ AND /);
    expect(args).toEqual(['2024-01-01', '2024-12-31', 'food', 'expense', '%lunch%', '%lunch%']);
  });

  it('10. SQL注入测试 → 参数化查询安全', async () => {
    const malicious = '"; DROP TABLE transactions; --';
    await getTransactions({ search: malicious });
    const { sql, args } = lastExecuteCall();
    // The injection string must NOT appear in the SQL itself
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).not.toContain(malicious);
    // It should be in the args as a parameterized value
    expect(args).toContain(`%${malicious}%`);
  });

  it('11. 结果排序 → ORDER BY date DESC, time DESC', async () => {
    await getTransactions();
    const { sql } = lastExecuteCall();
    expect(sql).toContain('ORDER BY date DESC, time DESC');
  });

  it('12. params顺序正确 → args数组顺序与SQL占位符一致', async () => {
    await getTransactions({
      startDate: '2024-01-01',
      endDate: '2024-06-30',
      category: 'transport',
      type: 'expense',
      search: 'uber',
    });
    const { sql, args } = lastExecuteCall();

    // Verify order matches the condition order in SQL:
    // is_duplicate=0 (no param), date>=?, date<=?, category_slug=?, type=?, LIKE?, LIKE?
    expect(args).toEqual([
      '2024-01-01',   // startDate
      '2024-06-30',   // endDate
      'transport',     // category
      'expense',       // type
      '%uber%',        // search description
      '%uber%',        // search counterparty
    ]);

    // Double-check SQL placeholder order
    const placeholdersBefore = (part: string) => {
      const idx = sql.indexOf(part);
      return (sql.slice(0, idx).match(/\?/g) || []).length;
    };
    expect(placeholdersBefore('date >= ?')).toBe(0);
    expect(placeholdersBefore('date <= ?')).toBe(1);
    expect(placeholdersBefore('category_slug = ?')).toBe(2);
  });
});

// ========================
// getTransactionById (2 cases)
// ========================
describe('getTransactionById', () => {
  it('13. 存在 → 返回 transaction', async () => {
    const mockTx = { id: 1, description: 'test', amount: -100 };
    mockExecute.mockResolvedValueOnce({ rows: [mockTx] });
    const result = await getTransactionById(1);
    expect(result).toEqual(mockTx);
    const { sql, args } = lastExecuteCall();
    expect(sql).toContain('WHERE id = ?');
    expect(args).toEqual([1]);
  });

  it('14. 不存在 → 返回 undefined', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const result = await getTransactionById(999);
    expect(result).toBeUndefined();
  });
});

// ========================
// insertTransactions (3 cases)
// ========================
describe('insertTransactions', () => {
  const baseTx = {
    source: 'alipay' as const,
    date: '2024-01-15',
    amount: -50,
    type: 'expense' as const,
    description: '午餐',
  };

  it('15. 单条插入 → batch调用参数正确', async () => {
    mockBatch.mockResolvedValueOnce([{ lastInsertRowid: 1 }]);
    const ids = await insertTransactions([baseTx]);
    expect(mockBatch).toHaveBeenCalledTimes(1);
    const stmts = mockBatch.mock.calls[0][0];
    expect(stmts).toHaveLength(1);
    expect(stmts[0].sql).toContain('INSERT INTO transactions');
    expect(ids).toEqual([1]);
  });

  it('16. 多条插入 → batch含多个stmts', async () => {
    mockBatch.mockResolvedValueOnce([
      { lastInsertRowid: 10 },
      { lastInsertRowid: 11 },
      { lastInsertRowid: 12 },
    ]);
    const txs = [baseTx, { ...baseTx, description: '晚餐' }, { ...baseTx, description: '早餐' }];
    const ids = await insertTransactions(txs);
    const stmts = mockBatch.mock.calls[0][0];
    expect(stmts).toHaveLength(3);
    expect(ids).toEqual([10, 11, 12]);
  });

  it('17. 可选字段缺失 → 使用默认值 (source_id→null, category_slug→uncategorized)', async () => {
    mockBatch.mockResolvedValueOnce([{ lastInsertRowid: 1 }]);
    await insertTransactions([baseTx]);
    const stmts = mockBatch.mock.calls[0][0];
    const args = stmts[0].args;
    // source_id (index 1) → null
    expect(args[1]).toBeNull();
    // time (index 3) → null
    expect(args[3]).toBeNull();
    // counterparty (index 7) → null
    expect(args[7]).toBeNull();
    // category_slug (index 8) → 'uncategorized'
    expect(args[8]).toBe('uncategorized');
    // payment_method (index 9) → null
    expect(args[9]).toBeNull();
    // note (index 10) → null
    expect(args[10]).toBeNull();
    // import_id (index 11) → null (no importId passed)
    expect(args[11]).toBeNull();
  });
});

// ========================
// updateTransaction (3 cases)
// ========================
describe('updateTransaction', () => {
  it('18. 正常更新 → SET子句正确', async () => {
    await updateTransaction(1, { description: '新描述', amount: -200 });
    const { sql, args } = lastExecuteCall();
    expect(sql).toContain('UPDATE transactions SET');
    expect(sql).toContain('description = ?');
    expect(sql).toContain('amount = ?');
    expect(sql).toContain("updated_at = datetime('now', 'localtime')");
    expect(sql).toContain('WHERE id = ?');
    // args: description, amount, id
    expect(args).toContain('新描述');
    expect(args).toContain(-200);
    expect(args[args.length - 1]).toBe(1); // id is last
  });

  it('19. 跳过 id 和 created_at → 不出现在SET中', async () => {
    await updateTransaction(1, { id: 999, created_at: '2020-01-01', description: 'test' } as any);
    const { sql } = lastExecuteCall();
    // id and created_at should not appear as SET fields
    // Extract just the SET clause (between SET and WHERE)
    const setClause = sql.match(/SET (.+?) WHERE/)?.[1] || '';
    expect(setClause).not.toContain('id = ?');
    expect(setClause).not.toContain('created_at = ?');
    expect(sql).toContain('description = ?');
  });

  it('20. 空更新 → fields为空不执行SQL', async () => {
    await updateTransaction(1, {});
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

// ========================
// deleteTransaction (1 case)
// ========================
describe('deleteTransaction', () => {
  it('21. 删除 → DELETE WHERE id = ?', async () => {
    await deleteTransaction(42);
    const { sql, args } = lastExecuteCall();
    expect(sql).toContain('DELETE FROM transactions WHERE id = ?');
    expect(args).toEqual([42]);
  });
});

// ========================
// getTransactionCount (3 cases)
// ========================
describe('getTransactionCount', () => {
  it('22. 无过滤 → COUNT(*)', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ cnt: 100 }] });
    await getTransactionCount();
    const { sql } = lastExecuteCall();
    expect(sql).toContain('SELECT COUNT(*) as cnt FROM transactions');
    expect(sql).toContain('WHERE is_duplicate = 0');
  });

  it('23. 有日期过滤 → 条件拼接', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ cnt: 50 }] });
    await getTransactionCount({ startDate: '2024-01-01', endDate: '2024-06-30' });
    const { sql, args } = lastExecuteCall();
    expect(sql).toContain('date >= ?');
    expect(sql).toContain('date <= ?');
    expect(args).toEqual(['2024-01-01', '2024-06-30']);
  });

  it('24. 返回数字', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [{ cnt: 42 }] });
    const result = await getTransactionCount();
    expect(result).toBe(42);
    expect(typeof result).toBe('number');
  });
});

// ========================
// getMonthlySummary (4 cases)
// ========================
describe('getMonthlySummary', () => {
  beforeEach(() => {
    // getMonthlySummary calls execute 4 times (totals, byCat, daily, excluded)
    mockExecute
      .mockResolvedValueOnce({ rows: [{ type: 'income', total: 5000 }, { type: 'expense', total: 3000 }] })
      .mockResolvedValueOnce({ rows: [{ slug: 'food', name: '餐饮', icon: '🍔', color: '#f00', amount: 1500 }] })
      .mockResolvedValueOnce({ rows: [{ date: '2024-01-15', amount: 200 }, { date: '2024-01-16', amount: 300 }] })
      .mockResolvedValueOnce({ rows: [] });
  });

  it('25. SQL排除 transfer 类型和 credit_card → STATS_EXCLUDE_SQL 生效', async () => {
    await getMonthlySummary('2024-01');
    // Check the first 3 execute calls (totals, byCat, daily) contain the exclusion
    for (let i = 0; i < 3; i++) {
      const sql = mockExecute.mock.calls[i][0].sql as string;
      expect(sql).toContain("type != 'transfer'");
      expect(sql).toContain("category_slug != 'credit_card'");
    }
  });

  it('26. 返回 totalIncome 和 totalExpense', async () => {
    const result = await getMonthlySummary('2024-01');
    expect(result.totalIncome).toBe(5000);
    expect(result.totalExpense).toBe(3000);
  });

  it('27. byCategory 分组正确', async () => {
    const result = await getMonthlySummary('2024-01');
    expect(result.byCategory).toHaveLength(1);
    expect(result.byCategory[0].slug).toBe('food');
    expect(result.byCategory[0].amount).toBe(1500);
  });

  it('28. dailyExpense 按日期排序', async () => {
    const result = await getMonthlySummary('2024-01');
    expect(result.dailyExpense).toHaveLength(2);
    // The SQL uses ORDER BY date, so check result order
    expect(result.dailyExpense[0].date).toBe('2024-01-15');
    expect(result.dailyExpense[1].date).toBe('2024-01-16');
    // Also verify the SQL has ORDER BY date
    const dailySql = mockExecute.mock.calls[2][0].sql as string;
    expect(dailySql).toContain('ORDER BY date');
  });
});

// ========================
// addCategoryRule (2 cases)
// ========================
describe('addCategoryRule', () => {
  it('29. source=user → priority=20', async () => {
    await addCategoryRule('星巴克', 'coffee', 'user');
    const { sql, args } = lastExecuteCall();
    expect(sql).toContain('INSERT INTO category_rules');
    expect(args).toEqual(['星巴克', 'coffee', 'user', 20]);
  });

  it('30. source=learned → priority=15', async () => {
    await addCategoryRule('滴滴', 'transport', 'learned');
    const { args } = lastExecuteCall();
    expect(args).toEqual(['滴滴', 'transport', 'learned', 15]);
  });
});

// ========================
// STATS_EXCLUDE_SQL 常量 (1 case)
// ========================
describe('STATS_EXCLUDE_SQL', () => {
  it('31. 确保排除 transfer 类型和 credit_card 分类', async () => {
    // We verify this through getMonthlySummary since the constant is not exported
    mockExecute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    await getMonthlySummary('2024-01');
    const sql = mockExecute.mock.calls[0][0].sql as string;
    expect(sql).toContain("type != 'transfer'");
    expect(sql).toContain("category_slug != 'credit_card'");
  });
});
