const { callCloud } = require('../../utils/request.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    i18n: {},
    accounts: [],
    accountId: '',
    fileName: '',
    selectedFileLine: '',
    csvText: '',
    previewCount: 0,
    previewRowsLine: '',
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    this.loadAccounts()
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    wx.setNavigationBarTitle({ title: t('importData.title') })
    this.setData({
      i18n: {
        hint: t('importData.hint'),
        selectFileBtn: t('importData.selectFileBtn'),
        defaultAccount: t('importData.defaultAccount'),
        preview: t('importData.preview'),
        startImport: t('importData.startImport'),
      },
    })
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
      /* ignore */
    }
  },

  onAcc(e) {
    this.setData({ accountId: e.detail.accountId })
  },

  pickFile() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
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
            const t2 = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
            this.setData({
              fileName: f.name,
              csvText: r.data,
              previewCount: 0,
              previewRowsLine: '',
              selectedFileLine: t2('importData.selectedFile', f.name),
            })
          },
          fail: () => wx.showToast({ title: t('importData.readFailed'), icon: 'none' }),
        })
      },
      fail: () => {
        wx.showToast({ title: t('importData.noFileSelected'), icon: 'none' })
      },
    })
  },

  async preview() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    if (!this.data.csvText) return
    try {
      const data = await callCloud('dataManage', {
        action: 'importPreview',
        csvText: this.data.csvText,
      })
      const count = data.count
      this.setData({
        previewCount: count,
        previewRowsLine: t('importData.previewRows', String(count)),
      })
      wx.showToast({ title: t('importData.previewDone'), icon: 'success' })
    } catch (e) {
      wx.showToast({ title: e.message || t('importData.previewFailed'), icon: 'none' })
    }
  },

  async doImport() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    if (!this.data.accountId) {
      wx.showToast({ title: t('importData.selectDefaultAccount'), icon: 'none' })
      return
    }
    if (!this.data.csvText) {
      wx.showToast({ title: t('importData.pleasePreview'), icon: 'none' })
      return
    }
    wx.showLoading({ title: t('importData.importing') })
    try {
      const data = await callCloud('dataManage', {
        action: 'importExecute',
        csvText: this.data.csvText,
        defaultAccountId: this.data.accountId,
      })
      wx.hideLoading()
      wx.showToast({ title: t('importData.importCountToast', String(data.inserted)), icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || t('common.failed'), icon: 'none' })
    }
  },
})
