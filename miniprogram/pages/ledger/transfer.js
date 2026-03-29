const { callCloud } = require('../../utils/request.js')
const { formatDate } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    accounts: [],
    fromId: '',
    toId: '',
    fromAccount: null,
    amount: '',
    date: '',
    note: '',
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadAccounts()
    if (!this.data.date) this.setData({ date: formatDate(new Date()) })
  },

  async loadAccounts() {
    try {
      const data = await callCloud('account', { action: 'list' })
      const list = data.list || []
      const fromId = list[0] ? list[0]._id : ''
      const toId = list[1] ? list[1]._id : fromId
      this.setData({
        accounts: list,
        fromId,
        toId,
        fromAccount: list[0] || null,
      })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },

  onFrom(e) {
    this.setData({
      fromId: e.detail.accountId,
      fromAccount: e.detail.account,
    })
  },
  onTo(e) {
    this.setData({ toId: e.detail.accountId })
  },
  onAmount(e) {
    this.setData({ amount: e.detail.value })
  },
  onDate(e) {
    this.setData({ date: e.detail.date })
  },
  onNote(e) {
    this.setData({ note: e.detail.value })
  },

  async save() {
    const { fromId, toId, amount, date, note } = this.data
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      wx.showToast({ title: '金额无效', icon: 'none' })
      return
    }
    if (!fromId || !toId || fromId === toId) {
      wx.showToast({ title: '请选择不同账户', icon: 'none' })
      return
    }
    wx.showLoading({ title: '处理中' })
    try {
      await callCloud('transaction', {
        action: 'create',
        type: 'transfer',
        amount: amt,
        category: '转账',
        fromAccountId: fromId,
        toAccountId: toId,
        date,
        note,
      })
      wx.hideLoading()
      wx.showToast({ title: '转账成功', icon: 'success' })
      wx.navigateBack()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    }
  },
})
