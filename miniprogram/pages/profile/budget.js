const { callCloud } = require('../../utils/request.js')
const { formatMoneySafe, fetchHideAmount, currentYearMonth } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

const WARN_KEY = 'nb_budget_warn_ym'

Page({
  data: {
    i18n: {},
    yearMonth: '',
    totalBudget: '',
    usage: null,
    alert80: true,
    alertOver: true,
    history: [],
    barClass: '',
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    fetchHideAmount().finally(() => {
      const ym = currentYearMonth()
      this.setData({ yearMonth: ym })
      this.load(ym)
      this.loadHistory()
    })
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    wx.setNavigationBarTitle({ title: t('budget.title') })
    this.setData({
      i18n: {
        monthThis: t('budget.monthThis', this.data.yearMonth || currentYearMonth()),
        monthTotalBudget: t('budget.monthTotalBudget'),
        inputPlaceholder: t('budget.inputPlaceholder'),
        copyPrevBudget: t('budget.copyPrevBudget'),
        alertAt80: t('budget.alertAt80'),
        alertWhenOver: t('budget.alertWhenOver'),
        save: t('common.save'),
        historyExecution: t('budget.historyExecution'),
      },
    })
  },

  maybeAlertBudget(total, used, budgetDoc) {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    if (!total || total <= 0 || !budgetDoc) return
    const pct = Math.min(100, Math.round((used / total) * 100))
    const ym = this.data.yearMonth
    const last = wx.getStorageSync(WARN_KEY) || ''
    if (last === ym) return
    if (pct >= 100 && budgetDoc.alertOver !== false) {
      wx.setStorageSync(WARN_KEY, ym)
      wx.showModal({
        title: t('budget.alertTitle'),
        content: t('budget.alertOverContent', formatMoneySafe(used), formatMoneySafe(total)),
        showCancel: false,
      })
      return
    }
    if (pct >= 80 && budgetDoc.alert80 !== false) {
      wx.setStorageSync(WARN_KEY, ym)
      wx.showModal({
        title: t('budget.alertTitle'),
        content: t('budget.alert80PercentContent', String(pct)),
        showCancel: false,
      })
    }
  },

  async load(ym) {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    try {
      const data = await callCloud('budget', { action: 'get', yearMonth: ym })
      const total = data.totalBudget || 0
      const used = data.used || 0
      const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
      let barClass = ''
      if (pct >= 100) barClass = 'danger'
      else if (pct >= 80) barClass = 'warn'
      else if (pct > 0) barClass = 'ok'
      const b = data.budget || {}
      const usedFmt = formatMoneySafe(used)
      const totalFmt = formatMoneySafe(total)
      this.setData({
        totalBudget: total ? String(total) : '',
        alert80: b.alert80 !== false,
        alertOver: b.alertOver !== false,
        usage: {
          used: usedFmt,
          total: totalFmt,
          pct,
          line: t('budget.usedSlashTotal', usedFmt, totalFmt),
        },
        barClass,
        i18n: Object.assign({}, this.data.i18n, {
          monthThis: t('budget.monthThis', ym),
        }),
      })
      this.maybeAlertBudget(total, used, b)
    } catch (e) {
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
    }
  },

  async loadHistory() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    try {
      const data = await callCloud('budget', { action: 'history', limit: 12 })
      const src = data.list || []
      const list = []
      for (var i = 0; i < src.length; i++) {
        var row = src[i]
        list.push(
          Object.assign({}, row, {
            usedFmt: formatMoneySafe(row.used),
            totalFmt: formatMoneySafe(row.totalBudget),
            label: row.yearMonth + (row.over ? t('budget.overTag') : ''),
          }),
        )
      }
      this.setData({ history: list })
    } catch (e) {
      /* ignore */
    }
  },

  onBudget(e) {
    this.setData({ totalBudget: e.detail.value })
  },

  toggleAlert80() {
    this.setData({ alert80: !this.data.alert80 })
  },

  toggleAlertOver() {
    this.setData({ alertOver: !this.data.alertOver })
  },

  async copyPrev() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    try {
      await callCloud('budget', {
        action: 'copyPrev',
        yearMonth: this.data.yearMonth,
      })
      wx.showToast({ title: t('budget.copySuccess'), icon: 'success' })
      this.load(this.data.yearMonth)
      this.loadHistory()
    } catch (e) {
      wx.showToast({ title: e.message || t('budget.copyFail'), icon: 'none' })
    }
  },

  async save() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const tb = Number(this.data.totalBudget)
    if (tb < 0) {
      wx.showToast({ title: t('budget.invalidBudget'), icon: 'none' })
      return
    }
    try {
      await callCloud('budget', {
        action: 'set',
        yearMonth: this.data.yearMonth,
        totalBudget: tb,
        alert80: this.data.alert80,
        alertOver: this.data.alertOver,
      })
      wx.showToast({ title: t('common.saved'), icon: 'success' })
      wx.removeStorageSync(WARN_KEY)
      this.load(this.data.yearMonth)
      this.loadHistory()
    } catch (e) {
      wx.showToast({ title: e.message || t('common.failed'), icon: 'none' })
    }
  },
})
