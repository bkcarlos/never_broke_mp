const { callCloud } = require('../../utils/request.js')
const { formatMoney, formatDate } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    date: '',
    list: [],
    summary: null,
    i18n: {}
  },

  onShow() {
    if (!auth.requireLogin()) return
    if (!this.data.date) {
      this.setData({ date: formatDate(new Date()) })
    }
    this.loadI18n()
    this.loadDaily()
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    this.setData({
      i18n: {
        income: t('ledger.income'),
        expense: t('ledger.expense'),
        noRecord: t('ledger.noRecord'),
        noNote: t('ledger.noNote')
      }
    })
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value })
    this.loadDaily()
  },

  async loadDaily() {
    try {
      const data = await callCloud('transaction', {
        action: 'daily',
        date: this.data.date,
      })
      let income = 0
      let expense = 0
      const list = (data.list || []).map((t) => {
        if (t.type === 'income') income += Number(t.amount)
        if (t.type === 'expense') expense += Number(t.amount)
        return {
          ...t,
          displayAmount: formatMoney(t.amount),
        }
      })
      this.setData({
        list,
        summary: {
          income: formatMoney(income),
          expense: formatMoney(expense),
        },
      })
    } catch (e) {
      const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
    }
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/ledger/record' })
  },

  onTapTx(e) {
    const id = e.currentTarget.dataset.id
    wx.showActionSheet({
      itemList: ['删除记录'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          try {
            await callCloud('transaction', { action: 'delete', id })
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadDaily()
          } catch (err) {
            wx.showToast({ title: err.message || '失败', icon: 'none' })
          }
        }
      },
    })
  },
})
