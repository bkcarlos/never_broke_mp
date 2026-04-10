const { callCloud } = require('../../utils/request.js')
const { formatMoneySafe, fetchHideAmount } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')
const { drawLineCanvas } = require('../../utils/chart-draw.js')

Page({
  data: {
    i18n: {},
    days: 30,
    forecast: null,
    chartPoints: [],
    useCanvas: true,
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    fetchHideAmount().finally(() => this.load())
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    wx.setNavigationBarTitle({ title: t('reports.cashflow') })
    this.setData({
      i18n: {
        days30: t('reports.days30'),
        days60: t('reports.days60'),
        days90: t('reports.days90'),
        summary: t('reports.summary'),
        currentBalance: t('reports.currentBalance'),
        avgDailyExpense: t('reports.avgDailyExpense'),
        minBalance: t('reports.minBalance'),
        minBalanceDate: t('reports.minBalanceDate'),
        riskHint: t('reports.riskHint'),
        balanceTrend: t('reports.balanceTrend'),
      },
    })
  },

  setDays(e) {
    this.setData({ days: Number(e.currentTarget.dataset.d) })
    this.load()
  },

  scheduleDraw() {
    wx.nextTick(() => {
      setTimeout(() => this.drawLine(), 80)
    })
  },

  drawLine() {
    wx.createSelectorQuery()
      .in(this)
      .select('#cfLineCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const r0 = res && res[0]
        if (!r0 || !r0.node) return
        const pts = this._cfPoints || []
        drawLineCanvas(r0.node, r0.width, r0.height, pts)
      })
  },

  async load() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    try {
      const settings = await callCloud('settings', { action: 'get' }).catch(() => ({
        settings: {},
      }))
      const safetyLine = Number((settings.settings && settings.settings.safetyLine) || 0)
      const forecast = await callCloud('cashflow', {
        days: this.data.days,
        safetyLine,
      })
      if (forecast.unsupportedMixedCurrency) {
        const currentBalanceByCurrency = forecast.currentBalanceByCurrency || {}
        const currencies = forecast.currencies || Object.keys(currentBalanceByCurrency)
        const balanceLines = currencies.map((currency) => ({
          currency,
          amount: formatMoneySafe(currentBalanceByCurrency[currency], currency),
        }))
        this._cfPoints = []
        this.setData({
          forecast: Object.assign({}, forecast, {
            balanceLines,
          }),
          chartPoints: [],
        })
        return
      }
      const series = forecast.series || []
      const balances = series.length ? series.map((p) => p.balance) : [0]
      const min = Math.min.apply(null, balances.concat([0]))
      const max = Math.max.apply(null, balances.concat([1]))
      const span = max - min || 1
      const chartPoints = series.map((p) => ({
        date: p.date,
        balance: formatMoneySafe(p.balance),
        pct: Math.round(((p.balance - min) / span) * 80) + 10,
      }))
      this._cfPoints = series.map((p) => ({
        label: p.date,
        value: Number(p.balance) || 0,
      }))
      const forecastView = Object.assign({}, forecast, {
        currentBalance: formatMoneySafe(forecast.currentBalance),
        avgDailyExpense: formatMoneySafe(forecast.avgDailyExpense),
        minBalance: formatMoneySafe(forecast.minBalance),
      })
      this.setData({
        forecast: forecastView,
        chartPoints,
      })
      this.scheduleDraw()
    } catch (e) {
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
    }
  },
})
