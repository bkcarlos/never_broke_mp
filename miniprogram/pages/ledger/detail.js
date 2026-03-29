const { callCloud } = require('../../utils/request.js')
const { formatMoney, formatDate } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')
const C = require('../../utils/constants.js')

const TYPE_LABELS = ['全部', '收入', '支出', '转账']

function uniqCategories() {
  return ['全部', ...new Set([...C.EXPENSE_CATEGORIES, ...C.INCOME_CATEGORIES])]
}

Page({
  data: {
    date: '',
    rawList: [],
    list: [],
    summary: null,
    i18n: {},
    typeLabels: TYPE_LABELS,
    typeIndex: 0,
    accountNames: ['全部账户'],
    accountIds: [''],
    accountIndex: 0,
    categoryLabels: uniqCategories(),
    categoryIndex: 0,
  },

  onShow() {
    if (!auth.requireLogin()) return
    if (!this.data.date) {
      this.setData({ date: formatDate(new Date()) })
    }
    this.loadI18n()
    this.loadAccountsForFilter()
    this.loadDaily()
  },

  onPullDownRefresh() {
    this.loadDaily().finally(() => wx.stopPullDownRefresh())
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    this.setData({
      i18n: {
        income: t('ledger.income'),
        expense: t('ledger.expense'),
        noRecord: t('ledger.noRecord'),
        noNote: t('ledger.noNote'),
        filterType: t('ledger.filterType'),
        filterAccount: t('ledger.filterAccount'),
        filterCategory: t('ledger.filterCategory'),
      },
    })
  },

  async loadAccountsForFilter() {
    try {
      const data = await callCloud('account', { action: 'list' })
      const list = data.list || []
      const names = ['全部账户']
      const ids = ['']
      list.forEach((a) => {
        names.push(a.name || '账户')
        ids.push(a._id)
      })
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
    try {
      const data = await callCloud('transaction', {
        action: 'daily',
        date: this.data.date,
      })
      const rawList = (data.list || []).map((t) => ({
        ...t,
        displayAmount: formatMoney(t.amount),
      }))
      this.setData({ rawList })
      this.applyFilters()
    } catch (e) {
      const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
    }
  },

  applyFilters() {
    const { rawList, typeIndex, accountIndex, accountIds, categoryIndex, categoryLabels } =
      this.data
    let list = rawList.slice()
    if (typeIndex === 1) list = list.filter((t) => t.type === 'income')
    else if (typeIndex === 2) list = list.filter((t) => t.type === 'expense')
    else if (typeIndex === 3) list = list.filter((t) => t.type === 'transfer')

    const aid = accountIds[accountIndex]
    if (aid) {
      list = list.filter((t) => t.accountId === aid || t.toAccountId === aid)
    }

    const cat = categoryLabels[categoryIndex]
    if (cat && cat !== '全部') {
      list = list.filter((t) => t.category === cat)
    }

    let income = 0
    let expense = 0
    list.forEach((t) => {
      if (t.type === 'income') income += Number(t.amount)
      if (t.type === 'expense') expense += Number(t.amount)
    })
    this.setData({
      list,
      summary: {
        income: formatMoney(income),
        expense: formatMoney(expense),
      },
    })
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/ledger/record' })
  },

  onTapTx(e) {
    const id = e.currentTarget.dataset.id
    const item = (this.data.list || []).find((x) => x._id === id)
    const canEdit = item && item.type !== 'transfer'
    const itemList = canEdit ? ['编辑', '删除'] : ['删除']
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
          title: '确认删除',
          content: '删除后无法恢复（余额不会自动回滚，请谨慎操作）',
          success: async (r) => {
            if (!r.confirm) return
            try {
              await callCloud('transaction', { action: 'delete', id })
              wx.showToast({ title: '已删除', icon: 'success' })
              this.loadDaily()
            } catch (err) {
              wx.showToast({ title: err.message || '失败', icon: 'none' })
            }
          },
        })
      },
    })
  },
})
