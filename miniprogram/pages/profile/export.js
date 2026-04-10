const { callCloud } = require('../../utils/request.js')
const { formatDate } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    i18n: {},
    startDate: '',
    endDate: '',
    url: '',
    presetLabels: [],
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    const end = formatDate(new Date())
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    const start = formatDate(d)
    this.setData({ startDate: start, endDate: end, url: '' })
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)

    wx.setNavigationBarTitle({ title: t('exportData.title') })

    this.setData({
      i18n: {
        quickRange: t('exportData.quickRange'),
        startDate: t('exportData.startDate'),
        endDate: t('exportData.endDate'),
        generate: t('exportData.generate'),
        copyLink: t('exportData.copyLink'),
        tryOpen: t('exportData.tryOpen'),
      },
      presetLabels: [
        t('exportData.presetThisMonth'),
        t('exportData.presetLast3Months'),
        t('exportData.presetLast6Months'),
        t('exportData.presetThisYear'),
        t('exportData.presetAll'),
      ],
    })
  },

  applyPreset(e) {
    const i = Number(e.currentTarget.dataset.i)
    const end = formatDate(new Date())
    const now = new Date()
    let s
    if (i === 0) {
      s = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (i === 1) {
      s = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
    } else if (i === 2) {
      s = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    } else if (i === 3) {
      s = new Date(now.getFullYear(), 0, 1)
    } else if (i === 4) {
      s = new Date(2000, 0, 1)
    } else {
      s = now
    }
    this.setData({
      startDate: formatDate(s),
      endDate: end,
      url: '',
    })
  },

  onStart(e) {
    this.setData({ startDate: e.detail.value })
  },
  onEnd(e) {
    this.setData({ endDate: e.detail.value })
  },

  async generate() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const { startDate, endDate } = this.data
    if (!startDate || !endDate || startDate > endDate) {
      wx.showToast({ title: t('exportData.invalidDateRange'), icon: 'none' })
      return
    }
    wx.showLoading({ title: t('exportData.generating') })
    try {
      const data = await callCloud('dataManage', {
        action: 'exportGenerate',
        startDate,
        endDate,
      })
      wx.hideLoading()
      this.setData({ url: data.tempFileURL || '' })
      if (!data.tempFileURL) {
        wx.showToast({ title: t('exportData.noTempLink'), icon: 'none' })
        return
      }
      wx.showToast({ title: t('exportData.generatedCount', [data.count]), icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || t('common.failed'), icon: 'none' })
    }
  },

  copy() {
    if (!this.data.url) return
    wx.setClipboardData({ data: this.data.url })
  },

  open() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const u = this.data.url
    if (!u) return
    wx.downloadFile({
      url: u,
      success: (res) => {
        wx.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          fail: () => wx.showToast({ title: t('exportData.cannotOpen'), icon: 'none' }),
        })
      },
      fail: () => wx.showToast({ title: t('exportData.downloadFailed'), icon: 'none' }),
    })
  },
})
