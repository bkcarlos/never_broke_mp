const { callCloud } = require('../../utils/request.js')
const { formatMoneySafe, fetchHideAmount } = require('../../utils/format.js')
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
    await fetchHideAmount()
    const firstPaint = !this.data.overview
    if (firstPaint) {
      this.setData({ loading: true, loadError: false })
    }
    try {
      await this.loadOverview({ keepCacheOnError: !firstPaint })
    } finally {
      this.setData({ loading: false })
    }
  },

  onPullDownRefresh() {
    this.loadI18n()
    this.loadOverview({ keepCacheOnError: true })
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

  async loadOverview(options = {}) {
    const { keepCacheOnError = false } = options
    const hadOverview = !!this.data.overview
    try {
      const raw = await callCloud('report', { action: 'homeOverview' })
      const hideAmount = !!raw.hideAmount
      const overview = {
        today: raw.today,
        budget: raw.budget,
        assets: raw.assets,
      }
      const total = Number(overview.budget.total) || 0
      const used = Number(overview.budget.used) || 0
      let pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
      let budgetBarClass = ''
      if (pct >= 80) budgetBarClass = 'danger'
      else if (pct >= 50) budgetBarClass = 'warn'
      else if (pct > 0) budgetBarClass = 'ok'
      const fmt = (v) => formatMoneySafe(v)
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
      if (keepCacheOnError && hadOverview) {
        const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
        wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
        return
      }
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
      await this.loadOverview()
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
