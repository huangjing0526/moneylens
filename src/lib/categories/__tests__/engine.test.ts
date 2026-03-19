import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TransactionInput, CategoryRule } from '@/types';

vi.mock('@/lib/db/queries', () => ({
  getCategoryRules: vi.fn(),
}));

import { getCategoryRules } from '@/lib/db/queries';
import { classifyTransaction, classifyTransactions, clearRulesCache } from '../engine';

const mockGetCategoryRules = vi.mocked(getCategoryRules);

function makeTransaction(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    source: 'alipay',
    date: '2024-01-15',
    amount: -100,
    type: 'expense',
    description: '测试',
    counterparty: '',
    ...overrides,
  };
}

function makeRule(overrides: Partial<CategoryRule> = {}): CategoryRule {
  return {
    id: 1,
    keyword: 'test',
    category_slug: 'food',
    source: 'user',
    priority: 10,
    ...overrides,
  };
}

beforeEach(() => {
  clearRulesCache();
  vi.clearAllMocks();
  mockGetCategoryRules.mockResolvedValue([]);
});

// ==================== 一、规则缓存机制（3个用例） ====================
describe('规则缓存机制', () => {
  it('首次调用从DB加载规则（验证 getCategoryRules 被调用1次）', async () => {
    await classifyTransaction(makeTransaction());
    expect(mockGetCategoryRules).toHaveBeenCalledTimes(1);
  });

  it('第二次调用使用缓存（getCategoryRules 仍然只被调用1次）', async () => {
    await classifyTransaction(makeTransaction());
    await classifyTransaction(makeTransaction());
    expect(mockGetCategoryRules).toHaveBeenCalledTimes(1);
  });

  it('clearRulesCache() 后重新加载（调用次数+1）', async () => {
    await classifyTransaction(makeTransaction());
    expect(mockGetCategoryRules).toHaveBeenCalledTimes(1);
    clearRulesCache();
    await classifyTransaction(makeTransaction());
    expect(mockGetCategoryRules).toHaveBeenCalledTimes(2);
  });
});

// ==================== 二、Step 1 DB规则匹配（6个用例） ====================
describe('Step 1: DB规则匹配', () => {
  it('单条规则命中 → 返回规则slug', async () => {
    mockGetCategoryRules.mockResolvedValue([
      makeRule({ keyword: '星巴克', category_slug: 'food', priority: 10 }),
    ]);
    const result = await classifyTransaction(makeTransaction({ description: '星巴克咖啡' }));
    expect(result).toBe('food');
  });

  it('多条规则不同priority → 选最高的', async () => {
    mockGetCategoryRules.mockResolvedValue([
      makeRule({ id: 1, keyword: '星巴克', category_slug: 'food', priority: 5 }),
      makeRule({ id: 2, keyword: '星巴克', category_slug: 'subscription', priority: 20 }),
    ]);
    const result = await classifyTransaction(makeTransaction({ description: '星巴克咖啡' }));
    expect(result).toBe('subscription');
  });

  it('相同priority → 第一个匹配胜出（> 而非 >=）', async () => {
    mockGetCategoryRules.mockResolvedValue([
      makeRule({ id: 1, keyword: '咖啡', category_slug: 'food', priority: 10 }),
      makeRule({ id: 2, keyword: '星巴克', category_slug: 'shopping', priority: 10 }),
    ]);
    const result = await classifyTransaction(makeTransaction({ description: '星巴克咖啡' }));
    expect(result).toBe('food');
  });

  it('keyword在counterparty中命中（text = desc + " " + cp）', async () => {
    mockGetCategoryRules.mockResolvedValue([
      makeRule({ keyword: '肯德基', category_slug: 'food', priority: 10 }),
    ]);
    const result = await classifyTransaction(makeTransaction({ description: '消费', counterparty: '肯德基' }));
    expect(result).toBe('food');
  });

  it('大小写不敏感（keyword=Netflix, desc=NETFLIX订阅）', async () => {
    mockGetCategoryRules.mockResolvedValue([
      makeRule({ keyword: 'Netflix', category_slug: 'subscription', priority: 10 }),
    ]);
    const result = await classifyTransaction(makeTransaction({ description: 'NETFLIX订阅' }));
    expect(result).toBe('subscription');
  });

  it('无规则命中 → 进入fuzzy', async () => {
    mockGetCategoryRules.mockResolvedValue([
      makeRule({ keyword: '不存在的关键字', category_slug: 'food', priority: 10 }),
    ]);
    const result = await classifyTransaction(makeTransaction({ description: 'ABCXYZ' }));
    expect(result).toBe('uncategorized');
  });
});

// ==================== 三、Step 2 fuzzyClassify 优先级链（44个用例） ====================
describe('Step 2: fuzzyClassify', () => {
  // 住房（4个）
  describe('住房 housing', () => {
    it.each([
      { cp: '房东张三', label: '房东' },
      { cp: '物业管理', label: '物业' },
      { cp: '自如公寓', label: '自如' },
      { cp: '链家地产', label: '链家' },
    ])('$label 在counterparty中 → housing', async ({ cp }) => {
      const result = await classifyTransaction(makeTransaction({ description: '房租', counterparty: cp }));
      expect(result).toBe('housing');
    });
  });

  // 订阅（6个）
  describe('订阅 subscription', () => {
    it.each([
      { desc: '88vip会员', label: '88vip' },
      { desc: 'api调用费', label: 'api' },
      { desc: '月费扣款', label: '月费' },
      { desc: '年费续期', label: '年费' },
      { desc: 'adspower订阅', label: 'adspower' },
      { desc: 'saas服务', label: 'saas' },
    ])('$label → subscription', async ({ desc }) => {
      const result = await classifyTransaction(makeTransaction({ description: desc }));
      expect(result).toBe('subscription');
    });
  });

  // 医疗（5个）
  describe('医疗 medical', () => {
    it.each([
      { desc: '药品购买', label: '药品' },
      { desc: '大众药店', label: '药店' },
      { desc: '国大药房消费', label: '大药房' },
      { desc: '中草药调理', label: '中草药' },
      { desc: '太子参炖品', label: '太子参' },
    ])('$label → medical', async ({ desc }) => {
      const result = await classifyTransaction(makeTransaction({ description: desc }));
      expect(result).toBe('medical');
    });
  });

  // 购物交易方（3个）
  describe('购物交易方 shopping (cp)', () => {
    it('拼多多cp → shopping', async () => {
      const result = await classifyTransaction(makeTransaction({ description: '消费', counterparty: '拼多多商家' }));
      expect(result).toBe('shopping');
    });

    it('名创优品cp → shopping', async () => {
      const result = await classifyTransaction(makeTransaction({ description: '消费', counterparty: '名创优品' }));
      expect(result).toBe('shopping');
    });

    it('拼多多在desc中 → shopping', async () => {
      const result = await classifyTransaction(makeTransaction({ description: '拼多多买东西' }));
      expect(result).toBe('shopping');
    });
  });

  // 购物关键字（8个）
  describe('购物关键字 shopping (word)', () => {
    it.each([
      { desc: 'XX旗舰店', label: '旗舰店' },
      { desc: '进口奶粉', label: '奶粉' },
      { desc: '纸尿裤大包装', label: '纸尿裤' },
      { desc: '儿童玩具', label: '玩具' },
      { desc: '运动鞋', label: '鞋' },
      { desc: '日用品采购', label: '日用品' },
      { desc: '享淘卡充值', label: '享淘卡' },
      { desc: '收钱码付款', label: '收钱码' },
    ])('$label → shopping', async ({ desc }) => {
      const result = await classifyTransaction(makeTransaction({ description: desc }));
      expect(result).toBe('shopping');
    });
  });

  // 食品交易方（5个）
  describe('食品交易方 food (cp)', () => {
    it('盒马cp → food', async () => {
      const result = await classifyTransaction(makeTransaction({ description: '消费', counterparty: '盒马鲜生' }));
      expect(result).toBe('food');
    });

    it('饿了么cp → food', async () => {
      const result = await classifyTransaction(makeTransaction({ description: '消费', counterparty: '饿了么外卖' }));
      expect(result).toBe('food');
    });

    it('美团cp → food', async () => {
      const result = await classifyTransaction(makeTransaction({ description: '消费', counterparty: '美团外卖' }));
      expect(result).toBe('food');
    });

    it('海底捞cp → food', async () => {
      const result = await classifyTransaction(makeTransaction({ description: '消费', counterparty: '海底捞火锅' }));
      expect(result).toBe('food');
    });

    it('盒马在desc中 → food', async () => {
      const result = await classifyTransaction(makeTransaction({ description: '盒马买菜' }));
      expect(result).toBe('food');
    });
  });

  // 食品关键字（6个）
  describe('食品关键字 food (word)', () => {
    it.each([
      { desc: '吃饭', label: '饭' },
      { desc: '奶茶下午茶', label: '奶茶' },
      { desc: '螺蛳粉加辣', label: '螺蛳粉' },
      { desc: '工作套餐', label: '套餐' },
      { desc: '菜市场买菜', label: '菜市场' },
      { desc: '麻辣烫加料', label: '麻辣烫' },
    ])('$label → food', async ({ desc }) => {
      const result = await classifyTransaction(makeTransaction({ description: desc }));
      expect(result).toBe('food');
    });
  });

  // 交通（3个）
  describe('交通 transport', () => {
    it.each([
      { desc: '共享单车骑行', label: '共享单车' },
      { desc: '顺风车拼车', label: '顺风车' },
      { desc: '代驾费用', label: '代驾' },
    ])('$label → transport', async ({ desc }) => {
      const result = await classifyTransaction(makeTransaction({ description: desc }));
      expect(result).toBe('transport');
    });
  });

  // 娱乐（3个）
  describe('娱乐 entertainment', () => {
    it.each([
      { desc: '景区门票购买', label: '景区门票' },
      { desc: '话剧演出', label: '演出' },
      { desc: '艺术展览', label: '展览' },
    ])('$label → entertainment', async ({ desc }) => {
      const result = await classifyTransaction(makeTransaction({ description: desc }));
      expect(result).toBe('entertainment');
    });
  });

  // 无匹配→null（1个）
  it('无匹配 → 进入heuristic回退', async () => {
    const result = await classifyTransaction(makeTransaction({ description: 'ZZZUNKNOWN999' }));
    expect(result).toBe('uncategorized');
  });
});

// ==================== 四、Step 3 启发式回退（23个用例） ====================
describe('Step 3: 启发式回退', () => {
  // transfer_self（9个）
  describe('transfer_self', () => {
    it.each([
      { desc: '余额宝收益发放', label: '余额宝' },
      { desc: '余利宝转入', label: '余利宝' },
      { desc: '理财产品赎回', label: '理财' },
      { desc: '基金定投扣款', label: '基金' },
      { desc: '零钱通转入', label: '零钱通' },
      { desc: '银行卡转入', label: '银行卡转入' },
      { desc: '银行卡定时转入', label: '银行卡定时转入' },
      { desc: '网商银行转入', label: '网商银行转入' },
      { desc: '网商银行转账', label: '网商银行转账' },
    ])('$label → transfer_self', async ({ desc }) => {
      const result = await classifyTransaction(makeTransaction({ description: desc }));
      expect(result).toBe('transfer_self');
    });
  });

  it('反例：网商银行查询（无转入/转账）→ 不命中transfer_self', async () => {
    const result = await classifyTransaction(makeTransaction({ description: '网商银行查询' }));
    expect(result).not.toBe('transfer_self');
  });

  // transfer（4个）
  describe('transfer', () => {
    it('"/"描述+有cp → transfer', async () => {
      const result = await classifyTransaction(makeTransaction({ description: '/', counterparty: '张三' }));
      expect(result).toBe('transfer');
    });

    it('空描述+有cp → transfer', async () => {
      const result = await classifyTransaction(makeTransaction({ description: '', counterparty: '李四' }));
      expect(result).toBe('transfer');
    });

    it('"-"描述+有cp → transfer', async () => {
      const result = await classifyTransaction(makeTransaction({ description: '-', counterparty: '王五' }));
      expect(result).toBe('transfer');
    });

    it('亲情卡 → transfer', async () => {
      const result = await classifyTransaction(makeTransaction({ description: '亲情卡消费' }));
      expect(result).toBe('transfer');
    });
  });

  // transfer 反例（2个）
  it('反例："/"描述无cp → 不是transfer', async () => {
    const result = await classifyTransaction(makeTransaction({ description: '/', counterparty: '' }));
    expect(result).not.toBe('transfer');
  });

  it('反例：空描述无cp → 不是transfer', async () => {
    const result = await classifyTransaction(makeTransaction({ description: '', counterparty: '' }));
    expect(result).not.toBe('transfer');
  });

  // income_other（1个）
  it('一淘提现 → income_other', async () => {
    const result = await classifyTransaction(makeTransaction({ description: '一淘提现到账' }));
    expect(result).toBe('income_other');
  });

  // income_other 反例（1个）
  it('反例：一淘返利（无提现）→ 不命中income_other', async () => {
    const result = await classifyTransaction(makeTransaction({ description: '一淘返利' }));
    expect(result).not.toBe('income_other');
  });

  // shopping: lidi/LIDI/黎蒂（3个）
  describe('shopping heuristic', () => {
    it('lidi小写 → shopping', async () => {
      const result = await classifyTransaction(makeTransaction({ description: 'lidi美发' }));
      expect(result).toBe('shopping');
    });

    it('LIDI大写 → shopping', async () => {
      const result = await classifyTransaction(makeTransaction({ description: 'LIDI造型' }));
      expect(result).toBe('shopping');
    });

    it('黎蒂 → shopping', async () => {
      const result = await classifyTransaction(makeTransaction({ description: '黎蒂美容' }));
      expect(result).toBe('shopping');
    });
  });

  // food: 客小妹（1个）
  it('客小妹 → food', async () => {
    const result = await classifyTransaction(makeTransaction({ description: '客小妹点餐' }));
    expect(result).toBe('food');
  });

  // uncategorized（1个）
  it('完全未知 ABCXYZ123 → uncategorized', async () => {
    const result = await classifyTransaction(makeTransaction({ description: 'ABCXYZ123' }));
    expect(result).toBe('uncategorized');
  });
});

// ==================== 五、classifyTransactions 批量（4个用例） ====================
describe('classifyTransactions 批量', () => {
  it('多条交易正确分类', async () => {
    mockGetCategoryRules.mockResolvedValue([
      makeRule({ keyword: '星巴克', category_slug: 'food', priority: 10 }),
    ]);
    const txns = [
      makeTransaction({ description: '星巴克咖啡' }),
      makeTransaction({ description: 'ABCXYZ123' }),
    ];
    const result = await classifyTransactions(txns);
    expect(result[0].category_slug).toBe('food');
    expect(result[1].category_slug).toBe('uncategorized');
  });

  it('已有 category_slug → 保留不覆盖（短路 ||）', async () => {
    const txns = [
      makeTransaction({ description: '星巴克咖啡', category_slug: 'entertainment' }),
    ];
    const result = await classifyTransactions(txns);
    expect(result[0].category_slug).toBe('entertainment');
  });

  it('空数组 → 空', async () => {
    const result = await classifyTransactions([]);
    expect(result).toEqual([]);
  });

  it('混合有slug/无slug', async () => {
    const txns = [
      makeTransaction({ description: '奶茶好喝' }),
      makeTransaction({ description: '未知消费', category_slug: 'medical' }),
      makeTransaction({ description: 'ABCXYZ123' }),
    ];
    const result = await classifyTransactions(txns);
    expect(result[0].category_slug).toBe('food');
    expect(result[1].category_slug).toBe('medical');
    expect(result[2].category_slug).toBe('uncategorized');
  });
});

// ==================== 六、优先级冲突（6个用例） ====================
describe('优先级冲突', () => {
  it('DB规则 vs fuzzy → DB优先（海底捞设为entertainment，fuzzy会给food）', async () => {
    mockGetCategoryRules.mockResolvedValue([
      makeRule({ keyword: '海底捞', category_slug: 'entertainment', priority: 10 }),
    ]);
    const result = await classifyTransaction(makeTransaction({ description: '海底捞聚餐', counterparty: '海底捞火锅' }));
    expect(result).toBe('entertainment');
  });

  it('housing vs subscription → 住房优先（cp=自如, desc含月费）', async () => {
    const result = await classifyTransaction(makeTransaction({ description: '月费扣款', counterparty: '自如' }));
    expect(result).toBe('housing');
  });

  it('subscription vs shopping → 订阅优先（desc=88vip年费）', async () => {
    const result = await classifyTransaction(makeTransaction({ description: '88vip年费续期' }));
    expect(result).toBe('subscription');
  });

  it('medical vs shopping → 医疗优先（desc=大药房买药）', async () => {
    const result = await classifyTransaction(makeTransaction({ description: '大药房买药' }));
    expect(result).toBe('medical');
  });

  it('shopping cp vs food cp → 购物优先（拼多多卖食品）', async () => {
    const result = await classifyTransaction(makeTransaction({ description: '食品消费', counterparty: '拼多多' }));
    expect(result).toBe('shopping');
  });

  it('shopping word vs food word → 购物优先（奶粉/婴儿用品在food词前）', async () => {
    const result = await classifyTransaction(makeTransaction({ description: '奶粉套餐组合' }));
    expect(result).toBe('shopping');
  });
});
