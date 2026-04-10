const { callCloud } = require('../../utils/request.js')
const { formatMoneySafe, fetchHideAmount, formatDate } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')
const C = require('../../utils/constants.js')
const {
  buildCategoryFilterOptions,
  getCategoryLabel,
  normalizeCategoryKey,
} = require('../../utils/category-label-helper.js')

function buildCategoryOptions(allLabel) {
  return buildCategoryFilterOptions(C.EXPENSE_CATEGORIES.concat(C.INCOME_CATEGORIES).concat(['transfer']), allLabel)
}

Page({
  data: {
    date: '',
    rawList: [],
    list: [],
    summary: null,
    i18n: {},
    typeLabels: [],
    typeIndex: 0,
    accountNames: [],
    accountIds: [''],
    accountIndex: 0,
    categoryOptions: [],
    categoryLabels: [],
    categoryIndex: 0,
  },

  onShow() {
    if (!auth.requireLogin()) return
    fetchHideAmount().finally(() => {
      if (!this.data.date) {
        this.setData({ date: formatDate(new Date()) })
      }
      this.loadI18n()
      this.loadAccountsForFilter()
      this.loadDaily()
    })
  },

  onPullDownRefresh() {
    this.loadDaily().finally(() => wx.stopPullDownRefresh())
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    wx.setNavigationBarTitle({ title: t('ledger.pageTitle') })
    const typeLabels = [t('ledger.all'), t('ledger.income'), t('ledger.expense'), t('ledger.transfer')]
    const categoryOptions = buildCategoryOptions(t('ledger.all'))
    this.setData({
      typeLabels,
      categoryOptions,
      categoryLabels: categoryOptions.map((item) => item.label),
      i18n: {
        income: t('ledger.income'),
        expense: t('ledger.expense'),
        transfer: t('ledger.transfer'),
        noRecord: t('ledger.noRecord'),
        noNote: t('ledger.noNote'),
        filterType: t('ledger.filterType'),
        filterAccount: t('ledger.filterAccount'),
        filterCategory: t('ledger.filterCategory'),
        edit: t('common.edit'),
        delete: t('common.delete'),
        deleteConfirmTitle: t('common.deleteConfirmTitle'),
        deleteConfirmBody: t('common.deleteConfirmBody'),
        deleted: t('common.deleted'),
        failed: t('common.failed'),
      },
    })
  },

  async loadAccountsForFilter() {
    try {
      const data = await callCloud('account', { action: 'list' })
      const list = data.list || []
      const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
      const names = [t('ledger.allAccounts')]
      const ids = ['']
      const byId = {}
      for (var i = 0; i < list.length; i++) {
        var a = list[i]
        byId[a._id] = a
        names.push(a.name || t('ledger.unnamedAccount'))
        ids.push(a._id)
      }
      this._accountsById = byId
      this.setData({ accountNames: names, accountIds: ids })
    } catch (e) {
      /* ignore */
    }
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value })
    this.loadDaily()
  },

  onTypeFilter(e) {
    this.setData({ typeIndex: Number(e.detail.value) || 0 })
    this.applyFilters()
  },

  onAccountFilter(e) {
    this.setData({ accountIndex: Number(e.detail.value) || 0 })
    this.applyFilters()
  },

  onCategoryFilter(e) {
    this.setData({ categoryIndex: Number(e.detail.value) || 0 })
    this.applyFilters()
  },

  async loadDaily() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    try {
      const data = await callCloud('transaction', {
        action: 'daily',
        date: this.data.date,
      })
      const byId = this._accountsById || {}
      const src = data.list || []
      const rawList = []
      for (var i = 0; i < src.length; i++) {
        var row = src[i]
        var acct = byId[row.accountId]
        var curCode = (acct && acct.currency) || 'CNY'
        rawList.push(
          Object.assign({}, row, {
            normalizedCategory: normalizeCategoryKey(row.category),
            categoryLabel: getCategoryLabel(row.category),
            displayAmount: formatMoneySafe(row.amount, curCode),
          }),
        )
      }
      this.setData({ rawList })
      this.applyFilters()
    } catch (e) {
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
    }
  },

  applyFilters() {
    const rawList = this.data.rawList
    const typeIndex = this.data.typeIndex
    const accountIndex = this.data.accountIndex
    const accountIds = this.data.accountIds
    const categoryIndex = this.data.categoryIndex
    const categoryOptions = this.data.categoryOptions
    var list = rawList.slice()
    if (typeIndex === 1) list = list.filter((x) => x.type === 'income')
    else if (typeIndex === 2) list = list.filter((x) => x.type === 'expense')
    else if (typeIndex === 3) list = list.filter((x) => x.type === 'transfer')

    const aid = accountIds[accountIndex]
    if (aid) {
      list = list.filter((x) => x.accountId === aid || x.toAccountId === aid)
    }

    if (categoryIndex > 0) {
      const cat = categoryOptions[categoryIndex] ? categoryOptions[categoryIndex].value : ''
      list = list.filter((x) => x.normalizedCategory === cat)
    }

    var income = 0
    var expense = 0
    list.forEach((x) => {
      if (x.type === 'income') income += Number(x.amount)
      if (x.type === 'expense') expense += Number(x.amount)
    })
    this.setData({
      list,
      summary: {
        income: formatMoneySafe(income),
        expense: formatMoneySafe(expense),
      },
    })
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/ledger/record' })
  },

  onTapTx(e) {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const id = e.currentTarget.dataset.id
    const item = (this.data.list || []).find((x) => x._id === id)
    const canEdit = item && item.type !== 'transfer'
    const itemList = canEdit ? [t('common.edit'), t('common.delete')] : [t('common.delete')]
    wx.showActionSheet({
      itemList,
      success: async (res) => {
        if (canEdit && res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/ledger/record?id=' + id })
          return
        }
        const isDelete = (!canEdit && res.tapIndex === 0) || (canEdit && res.tapIndex === 1)
        if (!isDelete) return
        wx.showModal({
          title: t('common.deleteConfirmTitle'),
          content: t('common.deleteConfirmBody'),
          success: async (r) => {
            if (!r.confirm) return
            try {
              await callCloud('transaction', { action: 'delete', id })
              wx.showToast({ title: t('common.deleted'), icon: 'success' })
              this.loadDaily()
            } catch (err) {
              wx.showToast({ title: err.message || t('common.failed'), icon: 'none' })
            }
          },
        })
      },
    })
  },
})
