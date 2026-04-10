const CURRENCY_SYMBOL = {
  CNY: '¥',
  HKD: 'HK$',
  USD: '$',
  EUR: '€',
}

/* ---- hideAmount 全局缓存 ---- */
let _hideAmount = false

/**
 * 从云端 settings 读取 hideAmount 并缓存。
 * 调用方在 onShow 里调一次即可，后续 formatMoneySafe 会自动使用缓存值。
 * 返回 Promise<boolean>（出错返回 false）
 */
function fetchHideAmount() {
  try {
    return wx.cloud
      .callFunction({ name: 'settings', data: { action: 'get' } })
      .then((res) => {
        const s = (res && res.result && res.result.data && res.result.data.settings) || {}
        _hideAmount = !!s.hideAmount
        return _hideAmount
      })
      .catch(() => false)
  } catch (e) {
    return Promise.resolve(false)
  }
}

/** 获取当前缓存的 hideAmount 状态 */
function getHideAmount() {
  return _hideAmount
}

/** 格式化金额（默认人民币；可按账户币种传入 HKD/USD/EUR 等） */
function formatMoney(amount, currency = 'CNY') {
  const n = Number(amount)
  if (Number.isNaN(n)) return '—'
  const code = currency || 'CNY'
  const sym = CURRENCY_SYMBOL[code] || `${code} `
  return sym + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 安全格式化金额：当全局 hideAmount 开启时返回 '****'
 * 参数签名与 formatMoney 一致，可无缝替换
 */
function formatMoneySafe(amount, currency = 'CNY') {
  if (_hideAmount) return '****'
  return formatMoney(amount, currency)
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
  formatMoneySafe,
  getHideAmount,
  fetchHideAmount,
  formatDate,
  currentYearMonth,
  pad2,
}
