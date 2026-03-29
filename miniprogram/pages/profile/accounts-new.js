const { callCloud } = require('../../utils/request.js')
const C = require('../../utils/constants.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    types: C.ACCOUNT_TYPES,
    type: 'savings',
    name: '',
    bank: '',
    balance: '',
    creditLimit: '',
    currencies: ['CNY', 'USD', 'EUR'],
    ci: 0,
  },

  onShow() {
    auth.requireLogin()
  },

  onType(e) {
    this.setData({ type: e.detail.value })
  },
  onName(e) {
    this.setData({ name: e.detail.value })
  },
  onBank(e) {
    this.setData({ bank: e.detail.value })
  },
  onBal(e) {
    this.setData({ balance: e.detail.value })
  },
  onLimit(e) {
    this.setData({ creditLimit: e.detail.value })
  },
  onCur(e) {
    this.setData({ ci: Number(e.detail.value) })
  },

  async save() {
    const { type, name, bank, balance, creditLimit, currencies, ci } = this.data
    if (!name.trim()) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    wx.showLoading({ title: '创建中' })
    try {
      await callCloud('account', {
        action: 'create',
        name: name.trim(),
        type,
        bank,
        balance: Number(balance) || 0,
        creditLimit: type === 'credit' ? Number(creditLimit) || 0 : 0,
        currency: currencies[ci],
      })
      wx.hideLoading()
      wx.showToast({ title: '已创建', icon: 'success' })
      wx.navigateBack()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    }
  },
})
