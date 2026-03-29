const { callCloud } = require('../../utils/request.js')
const { formatMoney, formatDate } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    list: [],
    accounts: [],
    name: '',
    amount: '',
    frequency: 'monthly',
    startDate: '',
    accountId: '',
  },

  onShow() {
    if (!auth.requireLogin()) return
    if (!this.data.startDate) this.setData({ startDate: formatDate(new Date()) })
    this.loadAccounts()
    this.loadList()
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
      // ignore
    }
  },

  async loadList() {
    try {
      const data = await callCloud('recurring', { action: 'list' })
      const list = (data.list || []).map((x) => ({
        ...x,
        displayAmount: formatMoney(x.amount),
      }))
      this.setData({ list })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },

  onName(e) {
    this.setData({ name: e.detail.value })
  },
  onAmt(e) {
    this.setData({ amount: e.detail.value })
  },
  onFreq(e) {
    this.setData({ frequency: e.detail.value })
  },
  onStart(e) {
    this.setData({ startDate: e.detail.date })
  },
  onAcc(e) {
    this.setData({ accountId: e.detail.accountId })
  },

  async create() {
    const { name, amount, frequency, startDate, accountId } = this.data
    if (!name.trim() || !Number(amount)) {
      wx.showToast({ title: '请填写名称和金额', icon: 'none' })
      return
    }
    if (!accountId) {
      wx.showToast({ title: '请先创建账户', icon: 'none' })
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
      wx.showToast({ title: '已保存', icon: 'success' })
      this.setData({ name: '', amount: '' })
      this.loadList()
    } catch (e) {
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    }
  },

  async realize(e) {
    const id = e.currentTarget.dataset.id
    try {
      const data = await callCloud('recurring', { action: 'realize', id })
      const inc = data.incomeRecorded
      if (inc) {
        await callCloud('transaction', {
          action: 'create',
          type: 'income',
          amount: inc.amount,
          category: '工资',
          accountId: inc.accountId,
          date: new Date().toISOString().slice(0, 10),
          note: inc.note || '周期收入',
        })
      }
      wx.showToast({ title: '已入账', icon: 'success' })
      this.loadList()
    } catch (err) {
      wx.showToast({ title: err.message || '失败', icon: 'none' })
    }
  },
})
