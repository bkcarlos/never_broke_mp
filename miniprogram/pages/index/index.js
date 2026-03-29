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
    i18n: {}
  },

  async onShow() {
    if (!auth.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    this.loadI18n()
    await Promise.all([
      this.loadSettings(),
      this.loadOverview()
    ])
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    this.setData({
      i18n: {
        todayExpense: t('home.todayExpense'),
        monthBudget: t('home.monthBudget'),
        budgetRemain: t('home.budgetRemain'),
        assetsOverview: t('home.assetsOverview'),
        multiAccount: t('home.multiAccount'),
        seeAccounts: t('home.seeAccounts'),
        recordBtn: t('home.recordBtn'),
        transferBtn: t('home.transferBtn'),
        reportsBtn: t('home.reportsBtn')
      }
    })
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
      const app = getApp()
      const t = app.globalData.i18n.t.bind(app.globalData.i18n)
      this.setData({
        overview,
        budgetPercent: pct,
        budgetBarClass,
        display: {
          todayExpense: fmt(overview.today.expense),
          todayCount: t('home.count', overview.today.count),
          budgetLine: `${fmt(overview.budget.used)} / ${fmt(overview.budget.total)}`,
          budgetRemain: t('home.budgetRemain', fmt(overview.budget.remain)),
          assetsTotal: fmt(overview.assets.total),
        },
      })
    } catch (e) {
      const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
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
