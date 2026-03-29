const { CLOUD_ENV_ID } = require('./config/env.js')

App({
  globalData: {
    cloudEnvId: CLOUD_ENV_ID,
    user: null,
    settings: null,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: CLOUD_ENV_ID,
      traceUser: true,
    })
  },
})
