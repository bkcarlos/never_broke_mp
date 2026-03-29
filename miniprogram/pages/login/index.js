const { callCloud } = require('../../utils/request.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    agreed: true,
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },

  async onWechatLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选协议', icon: 'none' })
      return
    }
    wx.showLoading({ title: '登录中' })
    try {
      const data = await callCloud('login', {
        nickName: '微信用户',
        avatarUrl: '',
      })
      const user = data.user
      auth.setStoredUser(user)
      const app = getApp()
      if (app && app.globalData) app.globalData.user = user
      wx.hideLoading()
      wx.showToast({ title: '欢迎', icon: 'success' })
      wx.switchTab({ url: '/pages/index/index' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '登录失败', icon: 'none' })
    }
  },
})
