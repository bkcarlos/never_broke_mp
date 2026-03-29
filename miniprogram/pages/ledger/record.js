const { callCloud } = require('../../utils/request.js')
const { formatDate } = require('../../utils/format.js')
const C = require('../../utils/constants.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    kind: 'expense',
    amount: '',
    category: '',
    categories: C.EXPENSE_CATEGORIES,
    accounts: [],
    accountId: '',
    date: '',
    note: '',
    createInstallment: false,
    installments: '6',
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadAccounts()
    const d = formatDate(new Date())
    if (!this.data.date) this.setData({ date: d })
    if (!this.data.category) {
      this.setData({
        category:
          this.data.kind === 'expense'
            ? C.EXPENSE_CATEGORIES[0]
            : C.INCOME_CATEGORIES[0],
      })
    }
  },

  setKind(e) {
    const k = e.currentTarget.dataset.k
    const categories = k === 'expense' ? C.EXPENSE_CATEGORIES : C.INCOME_CATEGORIES
    this.setData({
      kind: k,
      categories,
      category: categories[0],
      createInstallment: false,
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
      wx.showToast({ title: e.message || '加载账户失败', icon: 'none' })
    }
  },

  onAmount(e) {
    this.setData({ amount: e.detail.value })
  },
  onCategory(e) {
    this.setData({ category: e.detail.category })
  },
  onAccount(e) {
    this.setData({ accountId: e.detail.accountId })
  },
  onDate(e) {
    this.setData({ date: e.detail.date })
  },
  onNote(e) {
    this.setData({ note: e.detail.value })
  },
  toggleInst() {
    this.setData({ createInstallment: !this.data.createInstallment })
  },
  onInst(e) {
    this.setData({ installments: e.detail.value })
  },

  async save() {
    const { kind, amount, category, accountId, date, note, createInstallment, installments } =
      this.data
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    if (!accountId) {
      wx.showToast({ title: '请先创建账户', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中' })
    try {
      const txRes = await callCloud('transaction', {
        action: 'create',
        type: kind,
        amount: amt,
        category,
        accountId,
        date,
        note,
      })
      if (createInstallment && kind === 'expense') {
        const ins = parseInt(installments, 10) || 6
        await callCloud('installment', {
          action: 'create',
          title: category + '分期',
          totalAmount: amt,
          installments: ins,
          startDate: date,
          accountId,
          expenseTransactionId: (txRes.transaction && txRes.transaction._id) || '',
        })
      }
      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
      wx.navigateBack()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    }
  },
})
