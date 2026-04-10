const auth = require('../../utils/auth.js')

Page({
  data: {
    user: {},
    i18n: {}
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.setData({ user: auth.getStoredUser() || {} })
    this.loadI18n()
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    wx.setNavigationBarTitle({ title: t('profile.pageTitle') })
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    this.setData({
      i18n: {
        user: t('profile.user'),
        wechatLogin: t('profile.wechatLogin'),
        myTools: t('profile.myTools'),
        accounts: t('profile.accounts'),
        budget: t('profile.budget'),
        recurringIncome: t('profile.recurringIncome'),
        installment: t('profile.installment'),
        salary: t('profile.salary'),
        import: t('profile.import'),
        export: t('profile.export'),
        settings: t('profile.settings'),
        personalSettings: t('profile.personalSettings'),
        actionCenter: t('profile.actionCenter'),
        logout: t('profile.logout')
      }
    })
  },

  logout() {
    auth.clearAuth()
    wx.reLaunch({ url: '/pages/login/index' })
  },
})
