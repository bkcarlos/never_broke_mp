const { callCloud } = require('../../utils/request.js')
const auth = require('../../utils/auth.js')
const { TEMPLATE_IDS } = require('../../config/subscribe.js')
const { applyTabBarI18n } = require('../../utils/tabbar-i18n.js')

Page({
  data: {
    langs: ['中文', 'English'],
    li: 0,
    i18n: {},
    hideAmount: false,
    safetyLine: '',
    notifyBudget: true,
    notifyInstallment: true,
    notifyRecurring: true,
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    this.load()
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    wx.setNavigationBarTitle({ title: t('settings.title') })
    this.setData({
      i18n: {
        language: t('settings.language'),
        hideAmount: t('settings.hideAmount'),
        safetyLineHelp: t('settings.safetyLineHelp'),
        notifyBudget: t('settings.notifyBudget'),
        notifyInstallment: t('settings.notifyInstallment'),
        notifyRecurring: t('settings.notifyRecurring'),
        save: t('settings.save'),
        subscribeBtn: t('settings.subscribeBtn'),
        configTip: t('settings.configTip'),
      },
    })
  },

  async load() {
    try {
      const data = await callCloud('settings', { action: 'get' })
      const s = data.settings || {}
      this.setData({
        hideAmount: !!s.hideAmount,
        safetyLine: s.safetyLine != null ? String(s.safetyLine) : '',
        notifyBudget: s.notifyBudget !== false,
        notifyInstallment: s.notifyInstallment !== false,
        notifyRecurring: s.notifyRecurring !== false,
        li: s.language === 'en-US' ? 1 : 0,
      })
    } catch (e) {
      /* ignore */
    }
  },

  onLang(e) {
    this.setData({ li: Number(e.detail.value) })
  },
  onHide(e) {
    this.setData({ hideAmount: e.detail.value })
  },
  onSafety(e) {
    this.setData({ safetyLine: e.detail.value })
  },
  onN1(e) {
    this.setData({ notifyBudget: e.detail.value })
  },
  onN2(e) {
    this.setData({ notifyInstallment: e.detail.value })
  },
  onN3(e) {
    this.setData({ notifyRecurring: e.detail.value })
  },

  async save() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const {
      li,
      hideAmount,
      safetyLine,
      notifyBudget,
      notifyInstallment,
      notifyRecurring,
    } = this.data
    try {
      const language = li === 1 ? 'en-US' : 'zh-CN'
      await callCloud('settings', {
        action: 'update',
        language,
        hideAmount,
        safetyLine: Number(safetyLine) || 0,
        notifyBudget,
        notifyInstallment,
        notifyRecurring,
      })
      const app = getApp()
      if (app && app.globalData && app.globalData.i18n) {
        app.globalData.i18n.setLanguage(language)
      }
      applyTabBarI18n()
      wx.showToast({ title: t('settings.saved'), icon: 'success' })
    } catch (e) {
      wx.showToast({ title: e.message || t('settings.failed'), icon: 'none' })
    }
  },

  subscribe() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const ids = TEMPLATE_IDS.filter(Boolean)
    if (!ids.length) {
      wx.showToast({ title: t('settings.subscribeHint'), icon: 'none' })
      return
    }
    wx.requestSubscribeMessage({
      tmplIds: ids,
      success: () => wx.showToast({ title: t('settings.subscribeRequested'), icon: 'success' }),
      fail: (err) => wx.showToast({ title: err.errMsg || t('settings.failed'), icon: 'none' }),
    })
  },
})
