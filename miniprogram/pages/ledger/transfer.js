const { callCloud } = require('../../utils/request.js')
const { formatDate } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')
const { getCategoryLabel } = require('../../utils/category-label-helper.js')

Page({
  data: {
    formKey: 0,
    i18n: {},
    accounts: [],
    fromId: '',
    toId: '',
    fromAccount: null,
    amount: '',
    date: '',
    note: '',
  },

  onLoad() {
    this.setData({ formKey: (this.data.formKey || 0) + 1 })
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    this.loadAccounts()
    if (!this.data.date) this.setData({ date: formatDate(new Date()) })
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    wx.setNavigationBarTitle({ title: t('transfer.title') })
    this.setData({
      i18n: {
        fromAccount: t('transfer.fromAccount'),
        toAccount: t('transfer.toAccount'),
        amount: t('transfer.amount'),
        date: t('transfer.date'),
        note: t('transfer.note'),
        notePlaceholder: t('transfer.notePlaceholder'),
        confirm: t('transfer.confirm'),
        balanceHint: t('transfer.balanceHint'),
      },
    })
  },

  async loadAccounts() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
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
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
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
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const { fromId, toId, amount, date, note } = this.data
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      wx.showToast({ title: t('transfer.amountInvalid'), icon: 'none' })
      return
    }
    if (!fromId || !toId || fromId === toId) {
      wx.showToast({ title: t('transfer.selectDifferent'), icon: 'none' })
      return
    }
    wx.showLoading({ title: t('transfer.processing') })
    try {
      await callCloud('transaction', {
        action: 'create',
        type: 'transfer',
        amount: amt,
        category: 'transfer',
        fromAccountId: fromId,
        toAccountId: toId,
        date,
        note,
      })
      wx.hideLoading()
      wx.showToast({ title: t('transfer.success'), icon: 'success' })
      wx.navigateBack()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || t('transfer.failed'), icon: 'none' })
    }
  },
})
