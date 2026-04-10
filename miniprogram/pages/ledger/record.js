const { callCloud } = require('../../utils/request.js')
const { formatDate } = require('../../utils/format.js')
const C = require('../../utils/constants.js')
const auth = require('../../utils/auth.js')
const {
  buildCategoryOptions,
  getCategoryLabel,
  normalizeCategoryKey,
} = require('../../utils/category-label-helper.js')

const QUICK_KEY = 'nb_quick_expense_templates'

function defaultQuickTemplates() {
  return [
    { labelKey: 'record.quickBreakfast', category: 'food', amount: '' },
    { labelKey: 'record.quickSubway', category: 'transport', amount: '' },
    { labelKey: 'record.quickCoffee', category: 'food', amount: '' },
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
    formKey: 0,
    i18n: {},
    kind: 'expense',
    amount: '',
    category: '',
    categories: [],
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
    } else {
      this.setData({ editId: '', isEdit: false, formKey: (this.data.formKey || 0) + 1 })
    }
    this._rawQuickTemplates = loadQuickTemplates()
    this.setData({ quickTemplates: this.buildQuickTemplates() })
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    this.bootstrapShow()
  },

  buildCategories(kind) {
    return buildCategoryOptions(kind === 'expense' ? C.EXPENSE_CATEGORIES : C.INCOME_CATEGORIES)
  },

  buildQuickTemplates() {
    const app = getApp()
    const i18n = app && app.globalData ? app.globalData.i18n : null
    const t = i18n && typeof i18n.t === 'function' ? i18n.t.bind(i18n) : null
    return (this._rawQuickTemplates || defaultQuickTemplates()).map((item) => {
      const category = normalizeCategoryKey(item.category)
      const label = item.labelKey && t ? t(item.labelKey) : item.label || getCategoryLabel(category)
      return {
        ...item,
        category,
        label,
        categoryLabel: getCategoryLabel(category),
      }
    })
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    const isEdit = this.data.isEdit
    wx.setNavigationBarTitle({ title: isEdit ? t('record.editTitle') : t('record.title') })
    this.setData({
      quickTemplates: this.buildQuickTemplates(),
      i18n: {
        quickLabel: t('record.quickLabel'),
        amount: t('record.amount'),
        category: t('record.category'),
        account: t('record.account'),
        date: t('record.date'),
        note: t('record.note'),
        notePlaceholder: t('record.notePlaceholder'),
        save: t('record.save'),
        saveEdit: t('record.saveEdit'),
        createInstallment: t('record.createInstallment'),
        installmentPeriods: t('record.installmentPeriods'),
        installmentPlaceholder: t('record.installmentPlaceholder'),
        expense: t('ledger.expense'),
        income: t('ledger.income'),
      },
    })
  },

  async bootstrapShow() {
    await this.loadAccounts()
    const d = formatDate(new Date())
    if (!this.data.date && !this.data.isEdit) this.setData({ date: d })
    if (!this.data.isEdit && !this.data.category) {
      const categories = this.buildCategories(this.data.kind)
      this.setData({
        categories,
        category: categories[0] ? categories[0].value : '',
      })
    }
    if (this.data.editId && !this._editLoaded) {
      this._editLoaded = true
      await this.loadForEdit()
    }
  },

  async loadForEdit() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    wx.showLoading({ title: t('common.loading') })
    try {
      const data = await callCloud('transaction', { action: 'get', id: this.data.editId })
      const tx = data.transaction
      if (!tx) throw new Error(t('common.recordNotFound'))
      if (tx.type === 'transfer') {
        this.setData({ isTransferEdit: true })
        wx.hideLoading()
        wx.showModal({
          title: t('common.tip'),
          content: t('record.transferCannotEdit'),
          showCancel: false,
          success: () => wx.navigateBack(),
        })
        return
      }
      const kind = tx.type === 'income' ? 'income' : 'expense'
      const categories = this.buildCategories(kind)
      const normalizedCategory = normalizeCategoryKey(tx.category) || (categories[0] && categories[0].value) || ''
      this.setData({
        kind,
        categories,
        amount: String(tx.amount != null ? tx.amount : ''),
        category: normalizedCategory,
        accountId: tx.accountId || '',
        date: tx.date || formatDate(new Date()),
        note: tx.note || '',
        createInstallment: false,
        isTransferEdit: false,
      })
    } catch (e) {
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    } finally {
      wx.hideLoading()
    }
  },

  applyQuick(e) {
    if (this.data.isEdit) return
    const idx = Number(e.currentTarget.dataset.i)
    const tpl = this.data.quickTemplates[idx]
    if (!tpl) return
    const categories = this.buildCategories('expense')
    this.setData({
      kind: 'expense',
      categories,
      category: tpl.category || (categories[0] && categories[0].value) || '',
      amount: tpl.amount != null && tpl.amount !== '' ? String(tpl.amount) : this.data.amount,
      note: tpl.label || this.data.note,
    })
  },

  setKind(e) {
    if (this.data.isEdit) return
    const k = e.currentTarget.dataset.k
    const categories = this.buildCategories(k)
    this.setData({
      kind: k,
      categories,
      category: categories[0] ? categories[0].value : '',
      createInstallment: false,
    })
  },

  async loadAccounts() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    try {
      const data = await callCloud('account', { action: 'list' })
      const list = data.list || []
      const patch = { accounts: list }
      if (!this.data.isEdit && !this.data.accountId && list[0]) {
        patch.accountId = list[0]._id
      }
      this.setData(patch)
    } catch (e) {
      wx.showToast({ title: e.message || t('common.loadAccountFailed'), icon: 'none' })
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
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
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
      wx.showToast({ title: t('record.amountInvalid'), icon: 'none' })
      return
    }
    if (!accountId) {
      wx.showToast({ title: t('record.createAccountFirst'), icon: 'none' })
      return
    }
    wx.showLoading({ title: t('common.saving') })
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
        wx.showToast({ title: t('common.updated'), icon: 'success' })
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
          totalAmount: amt,
          periods: ins,
          startDate: date,
          accountId,
          title: note || getCategoryLabel(category),
          transactionId: txRes.transaction ? txRes.transaction._id : '',
        })
      }
      wx.hideLoading()
      wx.showToast({ title: t('common.saved'), icon: 'success' })
      wx.navigateBack()
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || t('common.failed'), icon: 'none' })
    }
  },
})
