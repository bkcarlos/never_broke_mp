const { callCloud } = require('../../utils/request.js')
const { formatDate } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    startDate: '',
    endDate: '',
    url: '',
  },

  onShow() {
    if (!auth.requireLogin()) return
    const end = formatDate(new Date())
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    const start = formatDate(d)
    this.setData({ startDate: start, endDate: end, url: '' })
  },

  onStart(e) {
    this.setData({ startDate: e.detail.value })
  },
  onEnd(e) {
    this.setData({ endDate: e.detail.value })
  },

  async generate() {
    const { startDate, endDate } = this.data
    if (!startDate || !endDate || startDate > endDate) {
      wx.showToast({ title: '日期范围无效', icon: 'none' })
      return
    }
    wx.showLoading({ title: '生成中' })
    try {
      const data = await callCloud('dataManage', {
        action: 'exportGenerate',
        startDate,
        endDate,
      })
      wx.hideLoading()
      this.setData({ url: data.tempFileURL || '' })
      if (!data.tempFileURL) {
        wx.showToast({ title: '无临时链接', icon: 'none' })
        return
      }
      wx.showToast({ title: `已生成 ${data.count} 条`, icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    }
  },

  copy() {
    if (!this.data.url) return
    wx.setClipboardData({ data: this.data.url })
  },

  open() {
    const u = this.data.url
    if (!u) return
    wx.downloadFile({
      url: u,
      success: (res) => {
        wx.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          fail: () => wx.showToast({ title: '无法打开', icon: 'none' }),
        })
      },
      fail: () => wx.showToast({ title: '下载失败', icon: 'none' }),
    })
  },
})
