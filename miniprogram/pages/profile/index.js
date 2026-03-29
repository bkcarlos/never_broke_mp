const auth = require('../../utils/auth.js')

Page({
  data: {
    user: {},
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.setData({ user: auth.getStoredUser() || {} })
  },

  logout() {
    auth.clearAuth()
    wx.reLaunch({ url: '/pages/login/index' })
  },
})
