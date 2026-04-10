const { callCloud } = require('../../utils/request.js')
const { formatMoneySafe, fetchHideAmount } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')
const { drawPieCanvas, drawLineCanvas } = require('../../utils/chart-draw.js')
const { getCategoryLabel } = require('../../utils/category-label-helper.js')

function buildCurrencyRows(totals, keys) {
  return keys.map((currency) => {
    const item = totals[currency] || {}
    return {
      currency,
      income: formatMoneySafe(item.income || 0, currency),
      expense: formatMoneySafe(item.expense || 0, currency),
      balance: formatMoneySafe(item.balance || 0, currency),
    }
  })
}

function buildCategorySections(totals, keys) {
  return keys
    .map((currency) => {
      const item = totals[currency] || {}
      const categories = (item.categories || []).map((c) => ({
        ...c,
        displayName: getCategoryLabel(c.name),
        rawAmount: Number(c.amount || 0),
        amount: formatMoneySafe(c.amount, currency),
      }))
      return {
        currency,
        totalExpense: formatMoneySafe(item.totalExpense || 0, currency),
        categories,
      }
    })
    .filter((section) => section.categories.length)
}

function buildTrendSections(list) {
  const grouped = {}
  ;(list || []).forEach((row) => {
    const expensesByCurrency = row.expensesByCurrency || {}
    Object.keys(expensesByCurrency).forEach((currency) => {
      if (!grouped[currency]) grouped[currency] = []
      grouped[currency].push({
        yearMonth: row.yearMonth,
        rawExpense: Number(expensesByCurrency[currency] || 0),
      })
    })
  })

  return Object.keys(grouped).map((currency) => {
    const rows = grouped[currency]
    let maxExp = 1
    rows.forEach((row) => {
      if (row.rawExpense > maxExp) maxExp = row.rawExpense
    })
    return {
      currency,
      list: rows.map((row) => ({
        yearMonth: row.yearMonth,
        expense: formatMoneySafe(row.rawExpense, currency),
        barPct: Math.round((row.rawExpense / maxExp) * 100),
      })),
      points: rows.map((row) => ({
        label: row.yearMonth,
        value: row.rawExpense,
      })),
    }
  })
}

Page({
  data: {
    i18n: {},
    yearMonth: '',
    monthPicker: '',
    summary: null,
    categorySections: [],
    trendSections: [],
    showCharts: false,
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    const ym = this.currentMonth()
    this.setData({
      yearMonth: ym,
      monthPicker: ym,
    })
    fetchHideAmount().finally(() => this.loadAll(ym))
  },

  currentMonth() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    wx.setNavigationBarTitle({ title: t('reports.title') })
    this.setData({
      i18n: {
        monthlySummary: t('reports.monthlySummary'),
        income: t('reports.income'),
        expense: t('reports.expense'),
        balance: t('reports.balance'),
        categoryRatio: t('reports.categoryRatio'),
        trend6Months: t('reports.trend6Months'),
        cashflow: t('reports.cashflow'),
        timeline: t('reports.timeline'),
        multiCurrencyHint: t('reports.multiCurrencyHint'),
      },
    })
  },

  onMonth(e) {
    const v = e.detail.value
    this.setData({ yearMonth: v, monthPicker: v })
    this.loadAll(v)
  },

  scheduleDraw() {
    wx.nextTick(() => {
      setTimeout(() => this.drawCharts(), 80)
    })
  },

  drawCharts() {
    const firstCategorySection = (this.data.categorySections || [])[0]
    const firstTrendSection = (this.data.trendSections || [])[0]
    const pieSlices = firstCategorySection
      ? firstCategorySection.categories.map((c) => ({
          name: c.displayName,
          value: Number(c.rawAmount || 0),
        }))
      : []
    const linePoints = firstTrendSection ? firstTrendSection.points || [] : []

    const q = wx.createSelectorQuery().in(this)
    q.select('#pieCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const r0 = res && res[0]
        if (r0 && r0.node && pieSlices.length) {
          drawPieCanvas(r0.node, r0.width, r0.height, pieSlices)
        }
        wx.createSelectorQuery()
          .in(this)
          .select('#lineCanvas')
          .fields({ node: true, size: true })
          .exec((res2) => {
            const r1 = res2 && res2[0]
            if (r1 && r1.node && linePoints.length) {
              drawLineCanvas(r1.node, r1.width, r1.height, linePoints)
            }
          })
      })
  },

  async loadAll(ym) {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    try {
      const [sum, cat, tr] = await Promise.all([
        callCloud('report', { action: 'monthlySummary', yearMonth: ym }),
        callCloud('report', { action: 'category', yearMonth: ym }),
        callCloud('report', { action: 'trend', months: 6 }),
      ])

      const summaryCurrencies = sum.currencies || Object.keys(sum.totals || {})
      const categoryCurrencies = cat.currencies || Object.keys(cat.totals || {})
      const summaryRows = buildCurrencyRows(sum.totals || {}, summaryCurrencies)
      const categorySections = buildCategorySections(cat.totals || {}, categoryCurrencies)
      const trendSections = buildTrendSections(tr.list || [])

      this.setData({
        summary: {
          multiCurrency: !!sum.multiCurrency,
          rows: summaryRows,
        },
        categorySections,
        trendSections,
        showCharts: categorySections.length > 0 || trendSections.length > 0,
      })
      this.scheduleDraw()
    } catch (e) {
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
    }
  },
})
