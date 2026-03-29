const { callCloud } = require('../../utils/request.js')
const { formatMoney } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')
const { drawPieCanvas, drawLineCanvas } = require('../../utils/chart-draw.js')

Page({
  data: {
    yearMonth: '',
    monthPicker: '',
    summary: null,
    categories: [],
    trend: [],
    showCharts: false,
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

  scheduleDraw() {
    wx.nextTick(() => {
      setTimeout(() => this.drawCharts(), 80)
    })
  },

  drawCharts() {
    const q = wx.createSelectorQuery().in(this)
    q.select('#pieCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const r0 = res && res[0]
        if (r0 && r0.node) {
          const slices = this._pieSlices || []
          drawPieCanvas(r0.node, r0.width, r0.height, slices)
        }
        wx.createSelectorQuery()
          .in(this)
          .select('#lineCanvas')
          .fields({ node: true, size: true })
          .exec((res2) => {
            const r1 = res2 && res2[0]
            if (r1 && r1.node) {
              const pts = this._linePoints || []
              drawLineCanvas(r1.node, r1.width, r1.height, pts)
            }
          })
      })
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
      const trend = tl.map((x) => ({
        ...x,
        expense: formatMoney(x.expense),
        barPct: Math.round((x.expense / maxExp) * 100),
      }))
      const categories = (cat.categories || []).map((c) => ({
        ...c,
        amount: formatMoney(c.amount),
      }))
      const pieSlices = (cat.categories || []).map((c) => ({
        name: c.name,
        value: Number(c.amount) || 0,
      }))
      const linePoints = (tr.list || []).map((x) => ({
        label: x.yearMonth,
        value: Number(x.expense) || 0,
      }))
      this._pieSlices = pieSlices
      this._linePoints = linePoints
      this.setData({
        summary: {
          income: formatMoney(sum.income),
          expense: formatMoney(sum.expense),
          balance: formatMoney(sum.balance),
        },
        categories,
        trend,
        showCharts: pieSlices.length > 0 || linePoints.length > 0,
      })
      this.scheduleDraw()
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
})
