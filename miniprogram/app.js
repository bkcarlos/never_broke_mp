const { CLOUD_ENV_ID, isCloudEnvConfigured } = require('./config/env.js')
const i18n = require('./i18n/index.js')
const { applyTabBarI18n } = require('./utils/tabbar-i18n.js')

App({
  globalData: {
    cloudEnvId: CLOUD_ENV_ID,
    user: null,
    settings: null,
    i18n
  },

  onLaunch() {
    i18n.init()
    applyTabBarI18n()
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云能力')
      return
    }
    if (!isCloudEnvConfigured()) {
      console.error(
        '[NeverBroke] 请在 miniprogram/config/env.js 中将 CLOUD_ENV_ID 改为云开发控制台中的环境 ID（当前仍为占位符）',
      )
    }
    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true,
    })
  },
})
