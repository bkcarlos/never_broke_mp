const { callCloud } = require('../../utils/request.js')
const { formatMoney, formatDate } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return formatDate(dt)
}

Page({
  data: {
    mode: 'past',
    pastList: [],
    futureList: [],
    pastDays: 60,
    pastRangeLabels: ['近30天', '近60天', '近90天'],
    pastRangeIndex: 1,
    expandedDate: '',
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadPast()
    this.loadFuture()
  },

  setMode(e) {
    this.setData({ mode: e.currentTarget.dataset.m })
  },

  onPastRange(e) {
    const idx = Number(e.detail.value) || 0
    const days = [30, 60, 90][idx] || 60
    this.setData({ pastRangeIndex: idx, pastDays: days })
    this.loadPast()
  },

  toggleExpand(e) {
    const date = e.currentTarget.dataset.date
    this.setData({
      expandedDate: this.data.expandedDate === date ? '' : date,
    })
  },

  async loadPast() {
    const end = formatDate(new Date())
    const start = addDays(end, -this.data.pastDays)
    try {
      const data = await callCloud('report', {
        action: 'timelineDailySummary',
        startDate: start,
        endDate: end,
      })
      const pastList = (data.list || []).map((x) => ({
        ...x,
        income: formatMoney(x.income),
        expense: formatMoney(x.expense),
      }))
      this.setData({ pastList })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },

  async loadFuture() {
    try {
      const [rec, ins] = await Promise.all([
        callCloud('recurring', { action: 'projected', days: 120 }),
        callCloud('installment', { action: 'list' }),
      ])
      const map = {}
      ;(rec.projections || []).forEach((p) => {
        if (!map[p.date]) map[p.date] = { date: p.date, inflows: [], outflows: [] }
        map[p.date].inflows.push({
          name: p.name,
          amount: formatMoney(p.amount),
        })
      })
      ;(ins.list || []).forEach((plan) => {
        ;(plan.schedule || []).forEach((s) => {
          if (s.paid) return
          if (!map[s.date]) map[s.date] = { date: s.date, inflows: [], outflows: [] }
          map[s.date].outflows.push({
            name: `${plan.title || '分期'} 第${s.index}期`,
            amount: formatMoney(s.amount),
          })
        })
      })
      const futureList = Object.values(map)
        .filter((row) => row.inflows.length || row.outflows.length)
        .sort((a, b) => a.date.localeCompare(b.date))
      this.setData({ futureList })
    } catch (e) {
      this.setData({ futureList: [] })
    }
  },

  async showDetail(e) {
    const date = e.currentTarget.dataset.date
    try {
      const data = await callCloud('report', {
        action: 'timelineDailyDetail',
        date,
      })
      const lines = (data.list || []).map((t) => {
        const sign = t.type === 'expense' ? '-' : t.type === 'income' ? '+' : '↔'
        return `${t.category} ${sign}${formatMoney(t.amount)}`
      })
      wx.showModal({
        title: date,
        content: lines.join('\n') || '无记录',
        showCancel: false,
      })
    } catch (err) {
      wx.showToast({ title: err.message || '失败', icon: 'none' })
    }
  },
})
