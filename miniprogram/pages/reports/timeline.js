const { callCloud } = require('../../utils/request.js')
const { formatMoney, formatDate } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    mode: 'past',
    pastList: [],
    projected: [],
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadPast()
    this.loadFuture()
  },

  setMode(e) {
    this.setData({ mode: e.currentTarget.dataset.m })
  },

  async loadPast() {
    const end = formatDate(new Date())
    const d = new Date()
    d.setDate(d.getDate() - 60)
    const start = formatDate(d)
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
      const data = await callCloud('recurring', { action: 'projected', days: 120 })
      const projected = (data.projections || []).map((p, index) => ({
        ...p,
        index: p.date + p.name + index,
        amount: formatMoney(p.amount),
      }))
      this.setData({ projected })
    } catch (e) {
      // ignore
    }
  },

  async showDetail(e) {
    const date = e.currentTarget.dataset.date
    try {
      const data = await callCloud('report', {
        action: 'timelineDailyDetail',
        date,
      })
      const lines = (data.list || [])
        .map((t) => `${t.category} ${t.type} ${formatMoney(t.amount)}`)
        .join('\n')
      wx.showModal({ title: date, content: lines || '无记录', showCancel: false })
    } catch (err) {
      wx.showToast({ title: err.message || '失败', icon: 'none' })
    }
  },
})
