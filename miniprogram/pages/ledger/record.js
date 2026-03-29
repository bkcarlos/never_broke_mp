const { callCloud } = require('../../utils/request.js')
const { formatDate } = require('../../utils/format.js')
const C = require('../../utils/constants.js')
const auth = require('../../utils/auth.js')

const QUICK_KEY = 'nb_quick_expense_templates'

function defaultQuickTemplates() {
  return [
    { label: '早餐', category: '餐饮', amount: '' },
    { label: '地铁', category: '交通', amount: '' },
    { label: '咖啡', category: '餐饮', amount: '' },
  ]
}

function loadQuickTemplates() {
  try {
    const raw = wx.getStorageSync(QUICK_KEY)
    if (Array.isArray(raw) && raw.length) return raw
  } catch (e) {
    /* ignore */
  }
  return defaultQuickTemplates()
}

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
    editId: '',
    isEdit: false,
    isTransferEdit: false,
    quickTemplates: [],
  },

  onLoad(options) {
    this._editLoaded = false
    const id = (options && options.id) || ''
    if (id) {
      this.setData({ editId: id, isEdit: true })
      wx.setNavigationBarTitle({ title: '编辑账单' })
    } else {
      this.setData({ editId: '', isEdit: false })
      wx.setNavigationBarTitle({ title: '记一笔' })
    }
    this.setData({ quickTemplates: loadQuickTemplates() })
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.bootstrapShow()
  },

  async bootstrapShow() {
    await this.loadAccounts()
    const d = formatDate(new Date())
    if (!this.data.date && !this.data.isEdit) this.setData({ date: d })
    if (!this.data.isEdit && !this.data.category) {
      this.setData({
        category:
          this.data.kind === 'expense'
            ? C.EXPENSE_CATEGORIES[0]
            : C.INCOME_CATEGORIES[0],
      })
    }
    if (this.data.editId && !this._editLoaded) {
      this._editLoaded = true
      await this.loadForEdit()
    }
  },

  async loadForEdit() {
    wx.showLoading({ title: '加载中' })
    try {
      const data = await callCloud('transaction', { action: 'get', id: this.data.editId })
      const tx = data.transaction
      if (!tx) throw new Error('记录不存在')
      if (tx.type === 'transfer') {
        this.setData({ isTransferEdit: true })
        wx.hideLoading()
        wx.showModal({
          title: '提示',
          content: '转账记录请在账户管理中调整余额，或删除后重新记账。',
          showCancel: false,
          success: () => wx.navigateBack(),
        })
        return
      }
      const kind = tx.type === 'income' ? 'income' : 'expense'
      const categories = kind === 'expense' ? C.EXPENSE_CATEGORIES : C.INCOME_CATEGORIES
      this.setData({
        kind,
        categories,
        amount: String(tx.amount != null ? tx.amount : ''),
        category: tx.category || categories[0],
        accountId: tx.accountId || '',
        date: tx.date || formatDate(new Date()),
        note: tx.note || '',
        createInstallment: false,
        isTransferEdit: false,
      })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    } finally {
      wx.hideLoading()
    }
  },

  applyQuick(e) {
    if (this.data.isEdit) return
    const idx = Number(e.currentTarget.dataset.i)
    const t = this.data.quickTemplates[idx]
    if (!t) return
    this.setData({
      kind: 'expense',
      categories: C.EXPENSE_CATEGORIES,
      category: t.category || C.EXPENSE_CATEGORIES[0],
      amount: t.amount != null && t.amount !== '' ? String(t.amount) : this.data.amount,
      note: t.label || this.data.note,
    })
  },

  setKind(e) {
    if (this.data.isEdit) return
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
      const patch = { accounts: list }
      if (!this.data.isEdit && !this.data.accountId && list[0]) {
        patch.accountId = list[0]._id
      }
      this.setData(patch)
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
    if (this.data.isTransferEdit) return
    const {
      kind,
      amount,
      category,
      accountId,
      date,
      note,
      createInstallment,
      installments,
      editId,
      isEdit,
    } = this.data
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
      if (isEdit && editId) {
        await callCloud('transaction', {
          action: 'update',
          id: editId,
          amount: amt,
          category,
          date,
          note,
        })
        wx.hideLoading()
        wx.showToast({ title: '已更新', icon: 'success' })
        wx.navigateBack()
        return
      }

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
