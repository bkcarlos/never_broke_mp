/** 同步 TabBar 文案与当前 i18n 语言（需在 app 已初始化 globalData.i18n 后调用） */
function applyTabBarI18n() {
  if (!wx.setTabBarItem) return
  const app = getApp()
  if (!app || !app.globalData || !app.globalData.i18n) return
  const t = app.globalData.i18n.t.bind(app.globalData.i18n)
  wx.setTabBarItem({ index: 0, text: t('tab.home') })
  wx.setTabBarItem({ index: 1, text: t('tab.ledger') })
  wx.setTabBarItem({ index: 2, text: t('tab.reports') })
  wx.setTabBarItem({ index: 3, text: t('tab.profile') })
}

module.exports = {
  applyTabBarI18n,
}
