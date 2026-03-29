/** 格式化金额（元） */
function formatMoney(amount, currency = 'CNY') {
  const n = Number(amount)
  if (Number.isNaN(n)) return '—'
  const sym = currency === 'CNY' ? '¥' : currency + ' '
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
