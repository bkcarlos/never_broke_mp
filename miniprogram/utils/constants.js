/** 支出分类 */
const EXPENSE_CATEGORIES = [
  '餐饮',
  '交通',
  '购物',
  '娱乐',
  '医疗',
  '教育',
  '住房',
  '通讯',
  '其他',
]

/** 收入分类 */
const INCOME_CATEGORIES = ['工资', '奖金', '投资收益', '兼职', '红包', '其他']

/** 账户类型 */
const ACCOUNT_TYPES = [
  { value: 'savings', label: '储蓄卡' },
  { value: 'credit', label: '信用卡' },
  { value: 'cash', label: '现金' },
  { value: 'investment', label: '投资账户' },
]

/** 常见银行（展示用，可选「其他」后手动输入） */
const BANKS = [
  '',
  '工商银行',
  '建设银行',
  '农业银行',
  '中国银行',
  '招商银行',
  '交通银行',
  '邮储银行',
  '其他',
]

module.exports = {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ACCOUNT_TYPES,
  BANKS,
}
