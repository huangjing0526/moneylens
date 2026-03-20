import { getCategoryRules } from '@/lib/db/queries';
import type { TransactionInput, CategoryRule } from '@/types';

let rulesCache: CategoryRule[] | null = null;

async function getRules(): Promise<CategoryRule[]> {
  if (!rulesCache) {
    rulesCache = await getCategoryRules();
  }
  return rulesCache;
}

export function clearRulesCache() {
  rulesCache = null;
}

// ---- Fuzzy word lists for fallback classification ----

const FOOD_WORDS = [
  // 菜品/烹饪
  '饭', '面', '粉', '粥', '汤', '煲', '锅', '炒', '烤', '炸', '蒸', '煮', '焖', '烧',
  '拌', '卤', '煎', '炖',
  // 食材
  '鸡', '鸭', '鱼', '虾', '蟹', '肉', '牛', '猪', '羊', '排骨', '翅', '腿',
  '豆腐', '青菜', '白菜', '土豆', '番茄', '西红柿', '黄瓜', '萝卜', '玉米',
  '蘑菇', '木耳', '海鲜', '鱿鱼', '三文鱼', '虾仁', '车厘子', '草莓',
  // 主食/小吃
  '饺子', '包子', '馒头', '馄饨', '烧麦', '春卷', '煎饼', '饼干', '饼', '披萨', '汉堡',
  '寿司', '拉面', '米线', '螺蛳粉', '凉皮', '肠粉', '皮皮虾',
  // 饮品/甜品
  '奶茶', '咖啡', '果汁', '酸奶', '豆浆', '蛋糕', '冰淇淋', '甜品', '巧克力',
  // 烹饪方式/口味
  '套餐', '单人餐', '双人餐', '大份', '小份', '加辣', '微辣', '麻辣',
  '香辣', '酸辣', '红烧', '清蒸', '水煮', '干锅', '铁板', '石锅',
  '椒盐', '糖醋', '宫保', '鱼香', '酱爆', '葱爆', '蒜蓉', '黑椒', '火腿',
  // 餐饮场所
  '食堂', '快餐', '早餐', '午餐', '晚餐', '夜宵', '宵夜', '小吃',
  '烧烤', '火锅', '串串', '麻辣烫', '冒菜',
  // 生鲜/菜市场
  '菜园', '菜满园', '百鲜', '生鲜', '鲜果', '菜市场', '菜场',
];

const FOOD_COUNTERPARTIES = [
  '盒马', '叮咚', '每日优鲜', '朴朴', '山姆', '永辉',
  '大润发', '沃尔玛', '家乐福', '物美', '华润万家',
  '饿了么', '美团', '达达', '闪送',
  '必胜客', '海底捞', '西贝', '呷哺', '太二',
  '百鲜汇', '菜满园', '菜园子',
];

const SHOPPING_WORDS = [
  '旗舰店', '专卖店', '代购', '包邮', '先用后付',
  '零食', '烟花', '爆竹', '烟酒', '白酒', '啤酒', '红酒', '香烟',
  '日用', '百货', '洗发', '沐浴', '纸巾', '牙膏',
  '服装', '鞋', '衣服', '裤', '毛巾', '方巾', '清货',
  '预售', '礼盒',
  // 家居/日用品
  '蚊帐', '床单', '被套', '枕头', '枕套', '床垫', '凉席', '被子',
  '窗帘', '地毯', '拖把', '扫把', '垃圾桶', '收纳', '置物架',
  '防摔', '防滑', '保护套', '手机壳', '钢化膜', '充电器', '数据线',
  '台灯', '灯泡', '插座', '排插', '晾衣架', '衣架',
  // 母婴用品
  '奶粉', '婴儿', '婴幼儿', '宝宝', '新生儿', '纸尿裤', '尿不湿',
  '奶瓶', '奶嘴', '吸管杯', '学饮杯', '水杯', '口水巾', '围嘴',
  '玩具', '牙胶', '手抓球', '安抚',
  // 享淘卡/充值卡
  '享淘卡', '电子卡',
  // 线下小店
  '经营码', '二维码收款', '收钱码',
  '减速带', '红包袋', '利是封',
];

const SHOPPING_COUNTERPARTIES = [
  '拼多多', '赵一鸣', '名创优品', '良品铺子', '三只松鼠', '来伊份',
  '抖音生活服务', '抖音商城',
  '批发', '清货', '服装', '服饰',
];

const TRANSPORT_WORDS = [
  '单车', '骑行', '共享', '顺风车', '快车', '专车', '代驾',
];

const ENTERTAINMENT_WORDS = [
  '门票', '景区', '乐园', '剧场', '演出', '音乐节', '展览',
];

const MEDICAL_WORDS = [
  '药品', '药店', '药房', '大药房', '医药', '医疗器械',
  '太子参', '中草药', '中药',
];

const SUBSCRIPTION_WORDS = [
  'api', '积分充值', '月费', '年费',
  '88vip', 'vip会员', 'pro会员',
  'salesmart', 'adspower', 'saas',
];

const HOUSING_COUNTERPARTIES = [
  '房东', '物业', '自如', '链家',
];

function fuzzyClassify(desc: string, counterparty: string): string | null {
  const text = desc.toLowerCase();
  const cp = counterparty.toLowerCase();
  const combined = `${text} ${cp}`;

  // Housing (rent/utilities) — check first, high confidence
  for (const name of HOUSING_COUNTERPARTIES) {
    if (cp.includes(name.toLowerCase())) return 'housing';
  }

  // Subscription/digital services — check before shopping to catch "88VIP"
  for (const word of SUBSCRIPTION_WORDS) {
    if (combined.includes(word.toLowerCase())) return 'subscription';
  }

  // Medical
  for (const word of MEDICAL_WORDS) {
    if (combined.includes(word.toLowerCase())) return 'medical';
  }

  // Shopping counterparties — check before food so 拼多多 etc. don't fall through
  for (const name of SHOPPING_COUNTERPARTIES) {
    if (cp.includes(name.toLowerCase()) || text.includes(name.toLowerCase())) return 'shopping';
  }

  // Shopping words — check BEFORE food words so 奶粉/婴儿用品 don't match food
  for (const word of SHOPPING_WORDS) {
    if (combined.includes(word)) return 'shopping';
  }

  // Food counterparties
  for (const name of FOOD_COUNTERPARTIES) {
    if (cp.includes(name.toLowerCase()) || text.includes(name.toLowerCase())) return 'food';
  }

  // Food words
  for (const word of FOOD_WORDS) {
    if (combined.includes(word)) return 'food';
  }

  // Transport words
  for (const word of TRANSPORT_WORDS) {
    if (combined.includes(word)) return 'transport';
  }

  // Entertainment words
  for (const word of ENTERTAINMENT_WORDS) {
    if (combined.includes(word)) return 'entertainment';
  }

  return null;
}

export async function classifyTransaction(t: TransactionInput): Promise<string> {
  const rules = await getRules();
  const text = `${t.description} ${t.counterparty || ''}`.toLowerCase();

  // Step 1: exact keyword rules from DB (highest priority)
  let bestMatch: { slug: string; priority: number } | null = null;
  for (const rule of rules) {
    if (text.includes(rule.keyword.toLowerCase())) {
      if (!bestMatch || rule.priority > bestMatch.priority) {
        bestMatch = { slug: rule.category_slug, priority: rule.priority };
      }
    }
  }
  if (bestMatch) return bestMatch.slug;

  // Step 2: fuzzy classification
  const fuzzyResult = fuzzyClassify(t.description, t.counterparty || '');
  if (fuzzyResult) return fuzzyResult;

  // Step 3: heuristic fallbacks
  const desc = t.description.trim();

  // Self-transfers (moving money between own accounts) → excluded from stats
  if (/余利宝|余额宝|理财|基金|零钱通|银行卡转入|银行卡定时转入/.test(text)) {
    return 'transfer_self';
  }
  if (text.includes('网商银行') && (text.includes('转入') || text.includes('转账'))) {
    return 'transfer_self';
  }

  // "/" or empty description with a person-like counterparty → transfer (to others)
  if ((desc === '/' || desc === '' || desc === '-') && t.counterparty) {
    return 'transfer';
  }

  // "亲情卡" → transfer (paying for family member)
  if (text.includes('亲情卡')) {
    return 'transfer';
  }

  // 一淘提现 → 其他收入
  if (text.includes('一淘') && text.includes('提现')) {
    return 'income_other';
  }

  // LIDI/黎蒂 (美发/美容) → 购物
  if (text.includes('lidi') || text.includes('黎蒂')) {
    return 'shopping';
  }

  // 客小妹 → 餐饮
  if (text.includes('客小妹')) {
    return 'food';
  }

  return 'uncategorized';
}

export async function classifyTransactions(transactions: TransactionInput[]): Promise<TransactionInput[]> {
  const rules = await getRules();
  return transactions.map(t => ({
    ...t,
    category_slug: t.category_slug || classifyTransactionSync(t, rules),
  }));
}

// Sync version used internally when rules are already loaded
function classifyTransactionSync(t: TransactionInput, rules: CategoryRule[]): string {
  const text = `${t.description} ${t.counterparty || ''}`.toLowerCase();

  let bestMatch: { slug: string; priority: number } | null = null;
  for (const rule of rules) {
    if (text.includes(rule.keyword.toLowerCase())) {
      if (!bestMatch || rule.priority > bestMatch.priority) {
        bestMatch = { slug: rule.category_slug, priority: rule.priority };
      }
    }
  }
  if (bestMatch) return bestMatch.slug;

  const fuzzyResult = fuzzyClassify(t.description, t.counterparty || '');
  if (fuzzyResult) return fuzzyResult;

  const desc = t.description.trim();
  if (/余利宝|余额宝|理财|基金|零钱通|银行卡转入|银行卡定时转入/.test(text)) return 'transfer_self';
  if (text.includes('网商银行') && (text.includes('转入') || text.includes('转账'))) return 'transfer_self';
  if ((desc === '/' || desc === '' || desc === '-') && t.counterparty) return 'transfer';
  if (text.includes('亲情卡')) return 'transfer';
  if (text.includes('一淘') && text.includes('提现')) return 'income_other';
  if (text.includes('lidi') || text.includes('黎蒂')) return 'shopping';
  if (text.includes('客小妹')) return 'food';

  return 'uncategorized';
}
