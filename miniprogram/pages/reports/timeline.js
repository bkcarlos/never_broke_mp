const { callCloud } = require('../../utils/request.js')
const { formatMoneySafe, fetchHideAmount, formatDate } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')
const { getCategoryLabel } = require('../../utils/category-label-helper.js')

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return formatDate(dt)
}

Page({
  data: {
    i18n: {},
    mode: 'past',
    pastList: [],
    futureList: [],
    pastDays: 60,
    pastRangeLabels: [],
    pastRangeIndex: 1,
    expandedDate: '',
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    fetchHideAmount().finally(() => {
      this.loadPast()
      this.loadFuture()
    })
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    wx.setNavigationBarTitle({ title: t('reports.timeline') })
    this.setData({
      pastRangeLabels: [t('reports.past30Days'), t('reports.past60Days'), t('reports.past90Days')],
      i18n: {
        history: t('reports.history'),
        future: t('reports.future'),
        noRecords: t('reports.noRecords'),
        noFuturePlans: t('reports.noFuturePlans'),
        income: t('reports.income'),
        expense: t('reports.expense'),
        viewDetail: t('reports.viewDetail'),
        expandHint: t('reports.expandHint'),
        projectedIncome: t('reports.projectedIncome'),
        projectedExpense: t('reports.projectedExpense'),
        noDetail: t('reports.noDetail'),
        detailFailed: t('reports.detailFailed'),
      },
    })
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
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const end = formatDate(new Date())
    const start = addDays(end, -this.data.pastDays)
    try {
      const data = await callCloud('report', {
        action: 'timelineDailySummary',
        startDate: start,
        endDate: end,
      })
      const src = data.list || []
      const pastList = []
      for (var i = 0; i < src.length; i++) {
        var x = src[i]
        pastList.push(
          Object.assign({}, x, {
            income: formatMoneySafe(x.income),
            expense: formatMoneySafe(x.expense),
            countLabel: t('reports.countRecords', String(x.count)),
          }),
        )
      }
      this.setData({ pastList })
    } catch (e) {
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
    }
  },

  async loadFuture() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
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
          amount: formatMoneySafe(p.amount),
        })
      })
      ;(ins.list || []).forEach((plan) => {
        ;(plan.schedule || []).forEach((s) => {
          if (s.paid) return
          if (!map[s.date]) map[s.date] = { date: s.date, inflows: [], outflows: [] }
          const title = plan.title || t('reports.installmentDefault')
          map[s.date].outflows.push({
            name: t('reports.installmentItem', title, String(s.index)),
            amount: formatMoneySafe(s.amount),
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
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const date = e.currentTarget.dataset.date
    try {
      const data = await callCloud('report', {
        action: 'timelineDailyDetail',
        date,
      })
      const lines = (data.list || []).map((row) => {
        const sign = row.type === 'expense' ? '-' : row.type === 'income' ? '+' : '↔'
        return getCategoryLabel(row.category) + ' ' + sign + formatMoneySafe(row.amount)
      })
      wx.showModal({
        title: date,
        content: lines.join('\n') || t('reports.noDetail'),
        showCancel: false,
      })
    } catch (err) {
      wx.showToast({ title: err.message || t('reports.detailFailed'), icon: 'none' })
    }
  },
})
