const { callCloud } = require('../../utils/request.js')
const auth = require('../../utils/auth.js')
const { TEMPLATE_IDS } = require('../../config/subscribe.js')

Page({
  data: {
    langs: ['中文', 'English'],
    li: 0,
    hideAmount: false,
    safetyLine: '',
    notifyBudget: true,
    notifyInstallment: true,
    notifyRecurring: true,
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.load()
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
      // ignore
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
    const {
      li,
      langs,
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
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    }
  },

  subscribe() {
    const ids = TEMPLATE_IDS.filter(Boolean)
    if (!ids.length) {
      wx.showToast({ title: '请先在 config/subscribe.js 配置模板ID', icon: 'none' })
      return
    }
    wx.requestSubscribeMessage({
      tmplIds: ids,
      success: () => wx.showToast({ title: '已请求', icon: 'success' }),
      fail: (err) => wx.showToast({ title: err.errMsg || '失败', icon: 'none' }),
    })
  },
})
