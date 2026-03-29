const { callCloud } = require('../../utils/request.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    accounts: [],
    accountId: '',
    fileName: '',
    csvText: '',
    previewCount: 0,
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadAccounts()
  },

  async loadAccounts() {
    try {
      const data = await callCloud('account', { action: 'list' })
      const list = data.list || []
      this.setData({
        accounts: list,
        accountId: list[0] ? list[0]._id : '',
      })
    } catch (e) {
      // ignore
    }
  },

  onAcc(e) {
    this.setData({ accountId: e.detail.accountId })
  },

  pickFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['csv'],
      success: (res) => {
        const f = res.tempFiles[0]
        const fs = wx.getFileSystemManager()
        fs.readFile({
          filePath: f.path,
          encoding: 'utf8',
          success: (r) => {
            this.setData({
              fileName: f.name,
              csvText: r.data,
              previewCount: 0,
            })
          },
          fail: () => wx.showToast({ title: '读取失败', icon: 'none' }),
        })
      },
      fail: () => {
        wx.showToast({ title: '未选择文件', icon: 'none' })
      },
    })
  },

  async preview() {
    if (!this.data.csvText) return
    try {
      const data = await callCloud('dataManage', {
        action: 'importPreview',
        csvText: this.data.csvText,
      })
      this.setData({
        previewCount: data.count,
      })
      wx.showToast({ title: '预览完成', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: e.message || '预览失败', icon: 'none' })
    }
  },

  async doImport() {
    if (!this.data.accountId) {
      wx.showToast({ title: '请选择默认账户', icon: 'none' })
      return
    }
    if (!this.data.csvText) {
      wx.showToast({ title: '请先选择并预览文件', icon: 'none' })
      return
    }
    wx.showLoading({ title: '导入中' })
    try {
      const data = await callCloud('dataManage', {
        action: 'importExecute',
        csvText: this.data.csvText,
        defaultAccountId: this.data.accountId,
      })
      wx.hideLoading()
      wx.showToast({ title: `导入 ${data.inserted} 条`, icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    }
  },
})
