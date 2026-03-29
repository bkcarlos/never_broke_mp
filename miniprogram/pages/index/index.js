const { callCloud } = require('../../utils/request.js')
const { formatMoney } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    overview: null,
    hideAmount: false,
    budgetPercent: 0,
    budgetBarClass: '',
    display: {},
  },

  async onShow() {
    if (!auth.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    await this.loadSettings()
    await this.loadOverview()
  },

  async loadSettings() {
    try {
      const data = await callCloud('settings', { action: 'get' })
      const hide = !!(data.settings && data.settings.hideAmount)
      this.setData({ hideAmount: hide })
    } catch (e) {
      this.setData({ hideAmount: false })
    }
  },

  async loadOverview() {
    try {
      const overview = await callCloud('report', { action: 'homeOverview' })
      const total = Number(overview.budget.total) || 0
      const used = Number(overview.budget.used) || 0
      let pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
      let budgetBarClass = ''
      if (pct >= 80) budgetBarClass = 'danger'
      else if (pct >= 50) budgetBarClass = 'warn'
      const hide = this.data.hideAmount
      const fmt = (v) => (hide ? '****' : formatMoney(v))
      this.setData({
        overview,
        budgetPercent: pct,
        budgetBarClass,
        display: {
          todayExpense: fmt(overview.today.expense),
          todayCount: overview.today.count,
          budgetLine: `${fmt(overview.budget.used)} / ${fmt(overview.budget.total)}`,
          budgetRemain: fmt(overview.budget.remain),
          assetsTotal: fmt(overview.assets.total),
        },
      })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/ledger/record' })
  },
  goTransfer() {
    wx.navigateTo({ url: '/pages/ledger/transfer' })
  },
  goReports() {
    wx.switchTab({ url: '/pages/reports/index' })
  },
})
