const USER_KEY = 'nb_user'
const SETTINGS_KEY = 'nb_settings_cache'

function getStoredUser() {
  try {
    return wx.getStorageSync(USER_KEY) || null
  } catch (e) {
    return null
  }
}

function setStoredUser(user) {
  wx.setStorageSync(USER_KEY, user || null)
}

function clearAuth() {
  wx.removeStorageSync(USER_KEY)
  wx.removeStorageSync(SETTINGS_KEY)
  const app = getApp()
  if (app && app.globalData) {
    app.globalData.user = null
    app.globalData.settings = null
  }
}

function isLoggedIn() {
  const u = getStoredUser()
  return !!(u && u._id)
}

function requireLogin() {
  if (!isLoggedIn()) {
    wx.reLaunch({ url: '/pages/login/index' })
    return false
  }
  return true
}

module.exports = {
  USER_KEY,
  SETTINGS_KEY,
  getStoredUser,
  setStoredUser,
  clearAuth,
  isLoggedIn,
  requireLogin,
}
