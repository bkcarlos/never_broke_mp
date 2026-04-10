/** 支出分类 key（稳定存储值） */
const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'shopping',
  'entertainment',
  'medical',
  'education',
  'housing',
  'communication',
  'other_expense',
]

/** 收入分类 key（稳定存储值） */
const INCOME_CATEGORIES = ['salary', 'bonus', 'investment', 'part_time', 'gift', 'other_income']

/** 兼容旧数据：中文分类 -> 稳定 key */
const LEGACY_CATEGORY_KEY_MAP = {
  餐饮: 'food',
  交通: 'transport',
  购物: 'shopping',
  娱乐: 'entertainment',
  医疗: 'medical',
  教育: 'education',
  住房: 'housing',
  通讯: 'communication',
  其他: 'other_expense',
  工资: 'salary',
  奖金: 'bonus',
  投资收益: 'investment',
  兼职: 'part_time',
  红包: 'gift',
  转账: 'transfer',
}

/** 兼容 key 的中文回退文案 */
const CATEGORY_FALLBACK_LABELS = {
  food: '餐饮',
  transport: '交通',
  shopping: '购物',
  entertainment: '娱乐',
  medical: '医疗',
  education: '教育',
  housing: '住房',
  communication: '通讯',
  other_expense: '其他',
  salary: '工资',
  bonus: '奖金',
  investment: '投资收益',
  part_time: '兼职',
  gift: '红包',
  other_income: '其他',
  transfer: '转账',
}

/** 账户类型（与后端一致：cash / bank / wallet / credit） */
const ACCOUNT_TYPES = [
  { value: 'cash', label: '现金' },
  { value: 'bank', label: '银行卡' },
  { value: 'wallet', label: '电子钱包' },
  { value: 'credit', label: '信用卡' },
]

/** 历史类型（仅编辑旧数据时展示） */
const LEGACY_ACCOUNT_TYPES = [
  { value: 'savings', label: '储蓄卡（旧）' },
  { value: 'investment', label: '投资账户（旧）' },
]

/** 类型展示名（含旧类型） */
const ACCOUNT_TYPE_LABELS = {
  cash: '现金',
  bank: '银行卡',
  wallet: '电子钱包',
  credit: '信用卡',
  savings: '储蓄卡',
  investment: '投资账户',
}

/** 电子钱包机构（value 存库，可与 other 自定义合并） */
const WALLET_INSTITUTIONS = [
  { value: 'wechat', label: '微信' },
  { value: 'alipay', label: '支付宝' },
  { value: 'other', label: '其他' },
]

/**
 * 机构/发卡行（展示用，含国内主要银行与香港主要银行；末项为「其他」手写）
 * 顺序：国有大行 → 股份制 → 常见城商行/农商 → 香港主要发钞行及常用银行
 */
const BANKS = [
  '',
  // 国有大型商业银行
  '工商银行',
  '农业银行',
  '中国银行',
  '建设银行',
  '交通银行',
  '邮储银行',
  // 全国性股份制商业银行
  '招商银行',
  '浦发银行',
  '中信银行',
  '光大银行',
  '华夏银行',
  '民生银行',
  '广发银行',
  '平安银行',
  '兴业银行',
  '浙商银行',
  '渤海银行',
  '恒丰银行',
  // 常见城商行 / 农商（代表）
  '北京银行',
  '上海银行',
  '江苏银行',
  '宁波银行',
  '南京银行',
  '杭州银行',
  '徽商银行',
  '重庆农村商业银行',
  '上海农商银行',
  '北京农商银行',
  '深圳农商银行',
  // 香港主要银行（含三大发钞行及常用中资/外资行）
  '香港上海汇丰银行',
  '渣打银行（香港）',
  '中国银行（香港）',
  '恒生银行',
  '工银亚洲',
  '建银亚洲',
  '农银香港',
  '交银香港',
  '花旗银行（香港）',
  '星展银行（香港）',
  '东亚银行',
  '大新银行',
  '众安银行',
  '其他',
]

/** 账户币种（创建账户可选） */
const CURRENCIES = ['CNY', 'HKD', 'USD', 'EUR']

module.exports = {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  LEGACY_CATEGORY_KEY_MAP,
  CATEGORY_FALLBACK_LABELS,
  ACCOUNT_TYPES,
  LEGACY_ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  WALLET_INSTITUTIONS,
  BANKS,
  CURRENCIES,
}
