const { callCloud } = require('../../utils/request.js')
const { formatMoney } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    days: 30,
    forecast: null,
    chartPoints: [],
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.load()
  },

  setDays(e) {
    this.setData({ days: Number(e.currentTarget.dataset.d) })
    this.load()
  },

  async load() {
    try {
      const settings = await callCloud('settings', { action: 'get' }).catch(() => ({
        settings: {},
      }))
      const safetyLine = Number((settings.settings && settings.settings.safetyLine) || 0)
      const forecast = await callCloud('cashflow', {
        days: this.data.days,
        safetyLine,
      })
      const series = forecast.series || []
      const balances = series.length ? series.map((p) => p.balance) : [0]
      const min = Math.min(...balances, 0)
      const max = Math.max(...balances, 1)
      const span = max - min || 1
      const chartPoints = series.map((p) => ({
        date: p.date,
        balance: formatMoney(p.balance),
        pct: Math.round(((p.balance - min) / span) * 80) + 10,
      }))
      this.setData({
        forecast: {
          ...forecast,
          currentBalance: formatMoney(forecast.currentBalance),
          avgDailyExpense: formatMoney(forecast.avgDailyExpense),
          minBalance: formatMoney(forecast.minBalance),
        },
        chartPoints,
      })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
})
