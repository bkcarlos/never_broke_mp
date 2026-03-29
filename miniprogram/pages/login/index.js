const { isCloudEnvConfigured } = require('../../config/env.js')
const { callCloud } = require('../../utils/request.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    agreed: true,
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },

  showTerms() {
    wx.showModal({
      title: '用户协议',
      content:
        'NeverBroke 为个人记账工具，您使用本小程序即表示同意我们按《隐私政策》处理必要信息。完整协议与政策以正式上线版本为准。',
      showCancel: false,
    })
  },

  showPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content:
        '我们仅在提供服务所必需的范围内处理您的数据（如记账、云同步），数据按微信云开发安全机制隔离存储。详情以正式上线版本为准。',
      showCancel: false,
    })
  },

  async onWechatLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选协议', icon: 'none' })
      return
    }
    if (!isCloudEnvConfigured()) {
      wx.showModal({
        title: '未配置云环境',
        content:
          '请打开 miniprogram/config/env.js，将 CLOUD_ENV_ID 替换为微信开发者工具「云开发」控制台里的环境 ID，并上传部署 login 等云函数。',
        showCancel: false,
      })
      return
    }

    let nickName = '微信用户'
    let avatarUrl = ''
    try {
      const profile = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于展示昵称与头像',
          success: resolve,
          fail: reject,
        })
      })
      if (profile.userInfo) {
        nickName = profile.userInfo.nickName || nickName
        avatarUrl = profile.userInfo.avatarUrl || ''
      }
    } catch (e) {
      // 用户拒绝授权时使用默认昵称，仍可登录（云函数以 openid 为准）
    }

    wx.showLoading({ title: '登录中' })
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
          title: '欢迎使用 NeverBroke',
          content: '先创建一个账户（如工资卡或微信零钱），即可开始记账。',
          confirmText: '去创建',
          cancelText: '稍后',
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
      wx.showToast({ title: '欢迎回来', icon: 'success' })
      wx.switchTab({ url: '/pages/index/index' })
    } catch (e) {
      wx.hideLoading()
      const msg =
        (e && e.message) ||
        (typeof e === 'string' ? e : '') ||
        '登录失败，请检查网络与云函数是否已部署'
      wx.showToast({ title: msg, icon: 'none', duration: 3000 })
    }
  },
})
