const CURRENCY_SYMBOL = {
  CNY: '¥',
  HKD: 'HK$',
  USD: '$',
  EUR: '€',
}

/** 格式化金额（默认人民币；可按账户币种传入 HKD/USD/EUR 等） */
function formatMoney(amount, currency = 'CNY') {
  const n = Number(amount)
  if (Number.isNaN(n)) return '—'
  const code = currency || 'CNY'
  const sym = CURRENCY_SYMBOL[code] || `${code} `
  return sym + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

/** YYYY-MM-DD */
function formatDate(d) {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return ''
  return (
    date.getFullYear() +
    '-' +
    pad2(date.getMonth() + 1) +
    '-' +
    pad2(date.getDate())
  )
}

/** 本月 YYYY-MM */
function currentYearMonth() {
  const now = new Date()
  return now.getFullYear() + '-' + pad2(now.getMonth() + 1)
}

module.exports = {
  formatMoney,
  formatDate,
  currentYearMonth,
  pad2,
}
