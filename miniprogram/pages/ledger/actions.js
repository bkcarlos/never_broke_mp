const auth = require('../../utils/auth.js')

Page({
  data: {
    i18n: {},
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)

    wx.setNavigationBarTitle({ title: t('actionCenter.title') })
    this.setData({
      i18n: {
        record: t('actionCenter.record'),
        transfer: t('actionCenter.transfer'),
        recurringIncome: t('actionCenter.recurringIncome'),
        installment: t('actionCenter.installment'),
      },
    })
  },
})
