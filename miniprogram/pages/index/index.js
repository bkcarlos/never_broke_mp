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
    i18n: {},
    loading: true,
    loadError: false,
    noAccounts: false,
    budgetNotSet: false,
  },

  async onShow() {
    if (!auth.isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/index' })
      return
    }
    this.loadI18n()
    this.setData({ loading: true, loadError: false })
    try {
      await Promise.all([this.loadSettings(), this.loadOverview()])
    } finally {
      this.setData({ loading: false })
    }
  },

  onPullDownRefresh() {
    this.loadI18n()
    Promise.all([this.loadSettings(), this.loadOverview()])
      .catch(() => {})
      .finally(() => wx.stopPullDownRefresh())
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
        reportsBtn: t('home.reportsBtn'),
        noAccountTip: t('home.noAccountTip'),
        createAccount: t('home.createAccount'),
        budgetNotSet: t('home.budgetNotSet'),
        setBudget: t('home.setBudget'),
        loadError: t('home.loadError'),
        retry: t('home.retry'),
      },
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
      else if (pct > 0) budgetBarClass = 'ok'
      const hide = this.data.hideAmount
      const fmt = (v) => (hide ? '****' : formatMoney(v))
      const app = getApp()
      const t = app.globalData.i18n.t.bind(app.globalData.i18n)
      const acc = overview.assets || {}
      const byType = acc.byType || {}
      const hasAnyAccount =
        Number(acc.total || 0) > 0 ||
        Object.values(byType).some((n) => Number(n) > 0)
      this.setData({
        overview,
        loadError: false,
        noAccounts: !hasAnyAccount,
        budgetNotSet: total <= 0,
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
      this.setData({ overview: null, loadError: true })
      const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
    }
  },

  goCreateAccount() {
    wx.navigateTo({ url: '/pages/profile/accounts-new' })
  },

  goBudget() {
    wx.navigateTo({ url: '/pages/profile/budget' })
  },

  goAccounts() {
    wx.navigateTo({ url: '/pages/profile/accounts' })
  },

  async retryLoad() {
    this.setData({ loading: true, loadError: false })
    try {
      await Promise.all([this.loadSettings(), this.loadOverview()])
    } finally {
      this.setData({ loading: false })
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
