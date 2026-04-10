const { isCloudEnvConfigured } = require('../../config/env.js')
const { callCloud } = require('../../utils/request.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    agreed: true,
    i18n: {},
  },

  onShow() {
    this.loadI18n()
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    this.setData({
      i18n: {
        tagline: t('login.tagline'),
        productName: t('login.productName'),
        subtitle: t('login.subtitle'),
        wechatLoginBtn: t('login.wechatLoginBtn'),
        agreeRead: t('login.agreeRead'),
        userTerms: t('login.userTerms'),
        connect: t('login.connect'),
        privacy: t('login.privacy'),
      },
    })
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },

  showTerms() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    wx.showModal({
      title: t('login.termsTitle'),
      content: t('login.termsBody'),
      showCancel: false,
    })
  },

  showPrivacy() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    wx.showModal({
      title: t('login.privacyTitle'),
      content: t('login.privacyBody'),
      showCancel: false,
    })
  },

  async onWechatLogin() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    if (!this.data.agreed) {
      wx.showToast({ title: t('login.agreeFirst'), icon: 'none' })
      return
    }
    if (!isCloudEnvConfigured()) {
      wx.showModal({
        title: t('login.cloudConfigTitle'),
        content: t('login.cloudConfigBody'),
        showCancel: false,
      })
      return
    }

    let nickName = t('login.defaultNick')
    let avatarUrl = ''
    try {
      const profile = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: t('login.profileDesc'),
          success: resolve,
          fail: reject,
        })
      })
      if (profile.userInfo) {
        nickName = profile.userInfo.nickName || nickName
        avatarUrl = profile.userInfo.avatarUrl || ''
      }
    } catch (e) {
      /* user declined */
    }

    wx.showLoading({ title: t('login.loggingIn') })
    try {
      const data = await callCloud('login', {
        nickName,
        avatarUrl,
      })
      const user = data.user
      const isNewUser = !!data.isNewUser
      auth.setStoredUser(user)
      const app = getApp()
      if (app && app.globalData) app.globalData.user = user
      wx.hideLoading()
      if (isNewUser) {
        wx.showModal({
          title: t('login.welcome'),
          content: t('login.welcomeNew'),
          confirmText: t('login.goCreate'),
          cancelText: t('login.later'),
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/pages/profile/accounts-new?onboarding=1' })
            } else {
              wx.switchTab({ url: '/pages/index/index' })
            }
          },
        })
        return
      }
      wx.showToast({ title: t('login.welcomeBack'), icon: 'success' })
      wx.switchTab({ url: '/pages/index/index' })
    } catch (e) {
      wx.hideLoading()
      const msg =
        (e && e.message) ||
        (typeof e === 'string' ? e : '') ||
        t('login.loginFailedDetail')
      wx.showToast({ title: msg, icon: 'none', duration: 3000 })
    }
  },
})
