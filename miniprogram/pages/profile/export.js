const { callCloud } = require('../../utils/request.js')
const { formatDate } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    i18n: {},
    startDate: '',
    endDate: '',
    url: '',
    exportCount: 0,
    hasJustCopied: false,
    hasDownloaded: false,
    presetLabels: [],
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    const end = formatDate(new Date())
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    const start = formatDate(d)
    this.resetExportResult({ startDate: start, endDate: end })
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
        copied: t('exportData.copied'),
        tryOpen: t('exportData.tryOpen'),
        successTitle: t('exportData.successTitle'),
        successDesc: t('exportData.successDesc', [this.data.exportCount]),
        linkExpired: t('exportData.linkExpired'),
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

  resetExportResult(extra = {}) {
    this.setData({
      url: '',
      exportCount: 0,
      hasJustCopied: false,
      hasDownloaded: false,
      ...extra,
    })
  },

  setExportResult(data) {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    this.setData({
      url: data.tempFileURL || '',
      exportCount: Number(data.count) || 0,
      hasJustCopied: false,
      hasDownloaded: false,
      i18n: {
        ...this.data.i18n,
        successDesc: t('exportData.successDesc', [Number(data.count) || 0]),
      },
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
    this.resetExportResult({
      startDate: formatDate(s),
      endDate: end,
    })
  },

  onStart(e) {
    this.resetExportResult({ startDate: e.detail.value })
  },

  onEnd(e) {
    this.resetExportResult({ endDate: e.detail.value })
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
      if (!data.tempFileURL) {
        this.resetExportResult()
        wx.showToast({ title: t('exportData.serverError'), icon: 'none' })
        return
      }
      this.setExportResult(data)
      wx.showToast({ title: t('exportData.successTitle'), icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      this.resetExportResult()
      const message = e.message || ''
      let title = t('common.failed')
      if (/no data|empty/i.test(message)) {
        title = t('exportData.noData')
      } else if (/expired|invalid/i.test(message)) {
        title = t('exportData.linkExpired')
      } else if (message) {
        title = message
      }
      wx.showToast({ title, icon: 'none' })
    }
  },

  copy() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    if (!this.data.url) return
    wx.setClipboardData({
      data: this.data.url,
      success: () => {
        this.setData({ hasJustCopied: true })
        wx.showToast({ title: t('exportData.copied'), icon: 'success' })
      },
      fail: () => wx.showToast({ title: t('common.failed'), icon: 'none' }),
    })
  },

  open() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const u = this.data.url
    if (!u) return
    wx.showLoading({ title: t('exportData.generating') })
    wx.downloadFile({
      url: u,
      success: (res) => {
        wx.hideLoading()
        if (res.statusCode !== 200 || !res.tempFilePath) {
          wx.showToast({ title: t('exportData.downloadFailed'), icon: 'none' })
          return
        }
        this.setData({ hasDownloaded: true })
        wx.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          success: () => wx.showToast({ title: t('common.success'), icon: 'success' }),
          fail: () => wx.showToast({ title: t('exportData.openFailed'), icon: 'none' }),
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: t('exportData.downloadFailed'), icon: 'none' })
      },
    })
  },
})
