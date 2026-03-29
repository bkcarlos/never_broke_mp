const { callCloud } = require('../../utils/request.js')
const { formatMoney } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    yearMonth: '',
    monthPicker: '',
    summary: null,
    categories: [],
    trend: [],
  },

  onShow() {
    if (!auth.requireLogin()) return
    const d = new Date()
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    this.setData({
      yearMonth: ym,
      monthPicker: ym,
    })
    this.loadAll(ym)
  },

  onMonth(e) {
    const v = e.detail.value
    this.setData({ yearMonth: v, monthPicker: v })
    this.loadAll(v)
  },

  async loadAll(ym) {
    try {
      const [sum, cat, tr] = await Promise.all([
        callCloud('report', { action: 'monthlySummary', yearMonth: ym }),
        callCloud('report', { action: 'category', yearMonth: ym }),
        callCloud('report', { action: 'trend', months: 6 }),
      ])
      const tl = tr.list || []
      const maxExp = tl.length ? Math.max(...tl.map((x) => x.expense), 1) : 1
      const trend = (tr.list || []).map((x) => ({
        ...x,
        expense: formatMoney(x.expense),
        barPct: Math.round((x.expense / maxExp) * 100),
      }))
      const categories = (cat.categories || []).map((c) => ({
        ...c,
        amount: formatMoney(c.amount),
      }))
      this.setData({
        summary: {
          income: formatMoney(sum.income),
          expense: formatMoney(sum.expense),
          balance: formatMoney(sum.balance),
        },
        categories,
        trend,
      })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
})
