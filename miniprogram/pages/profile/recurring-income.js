const { callCloud } = require('../../utils/request.js')
const { formatMoneySafe, fetchHideAmount, formatDate } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')
const { getCategoryLabel } = require('../../utils/category-label-helper.js')

function freqLabel(t, f) {
  if (f === 'weekly') return t('recurring.frequencyWeekly')
  if (f === 'yearly') return t('recurring.frequencyYearly')
  return t('recurring.frequencyMonthly')
}

Page({
  data: {
    formKey: 0,
    i18n: {},
    list: [],
    accounts: [],
    name: '',
    amount: '',
    frequency: 'monthly',
    startDate: '',
    accountId: '',
  },

  onLoad() {
    this.setData({ formKey: (this.data.formKey || 0) + 1 })
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    if (!this.data.startDate) this.setData({ startDate: formatDate(new Date()) })
    fetchHideAmount().finally(() => {
      this.loadAccounts()
      this.loadList()
    })
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    wx.setNavigationBarTitle({ title: t('recurring.title') })
    this.setData({
      i18n: {
        sectionActive: t('recurring.sectionActive'),
        sectionNew: t('recurring.sectionNew'),
        dueTag: t('recurring.dueTag'),
        realizeBtn: t('recurring.realizeBtn'),
        deleteBtn: t('recurring.deleteBtn'),
        namePlaceholder: t('recurring.namePlaceholder'),
        amount: t('recurring.amount'),
        frequencyWeekly: t('recurring.frequencyWeekly'),
        frequencyMonthly: t('recurring.frequencyMonthly'),
        frequencyYearly: t('recurring.frequencyYearly'),
        nextDuePrefix: t('recurring.nextDuePrefix'),
        startDateLabel: t('recurring.startDateLabel'),
        relatedAccount: t('recurring.relatedAccount'),
        save: t('common.save'),
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

  async loadList() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    try {
      const data = await callCloud('recurring', { action: 'list' })
      const today = new Date().toISOString().slice(0, 10)
      const src = data.list || []
      const list = []
      for (var i = 0; i < src.length; i++) {
        var x = src[i]
        list.push(
          Object.assign({}, x, {
            displayAmount: formatMoneySafe(x.amount),
            frequencyLabel: freqLabel(t, x.frequency),
            isDue: x.nextDueDate <= today,
          }),
        )
      }
      this.setData({ list })
    } catch (e) {
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
    }
  },

  onName(e) {
    this.setData({ name: e.detail.value })
  },
  onAmt(e) {
    this.setData({ amount: e.detail.value })
  },
  pickFreq(e) {
    const v = e.currentTarget.dataset.v
    if (v) this.setData({ frequency: v })
  },
  onStart(e) {
    this.setData({ startDate: e.detail.date })
  },
  onAcc(e) {
    this.setData({ accountId: e.detail.accountId })
  },

  async create() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const { name, amount, frequency, startDate, accountId } = this.data
    if (!name.trim() || !Number(amount)) {
      wx.showToast({ title: t('recurring.fillNameAmount'), icon: 'none' })
      return
    }
    if (!accountId) {
      wx.showToast({ title: t('record.createAccountFirst'), icon: 'none' })
      return
    }
    try {
      await callCloud('recurring', {
        action: 'create',
        name: name.trim(),
        amount: Number(amount),
        frequency,
        startDate,
        accountId,
      })
      wx.showToast({ title: t('common.saved'), icon: 'success' })
      this.setData({ name: '', amount: '' })
      this.loadList()
    } catch (e) {
      wx.showToast({ title: e.message || t('common.failed'), icon: 'none' })
    }
  },

  async realize(e) {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const id = e.currentTarget.dataset.id
    try {
      const data = await callCloud('recurring', { action: 'realize', id })
      const inc = data.incomeRecorded
      if (inc) {
        const recurringCategory = inc.category || 'salary'
        const recurringNoteSuffix = t('recurring.recurringNoteSuffix')
        await callCloud('transaction', {
          action: 'create',
          type: 'income',
          amount: inc.amount,
          category: recurringCategory,
          accountId: inc.accountId,
          date: formatDate(new Date()),
          note: (inc.note || getCategoryLabel(recurringCategory)) + recurringNoteSuffix,
        })
      }
      wx.showToast({ title: t('recurring.recorded'), icon: 'success' })
      this.loadList()
    } catch (err) {
      wx.showToast({ title: err.message || t('common.failed'), icon: 'none' })
    }
  },

  async removeItem(e) {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || ''
    wx.showModal({
      title: t('recurring.deleteTitle'),
      content: t('recurring.deleteContent', name),
      success: async (r) => {
        if (!r.confirm) return
        try {
          await callCloud('recurring', { action: 'delete', id })
          wx.showToast({ title: t('common.deleted'), icon: 'success' })
          this.loadList()
        } catch (err) {
          wx.showToast({ title: err.message || t('common.failed'), icon: 'none' })
        }
      },
    })
  },
})
