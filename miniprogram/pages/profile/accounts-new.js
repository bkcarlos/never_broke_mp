const { callCloud } = require('../../utils/request.js')
const C = require('../../utils/constants.js')
const auth = require('../../utils/auth.js')

const { BANKS } = C

Page({
  data: {
    types: C.ACCOUNT_TYPES,
    type: 'savings',
    name: '',
    bank: '',
    bankIndex: 0,
    banks: BANKS,
    balance: '',
    creditLimit: '',
    currencies: ['CNY', 'USD', 'EUR'],
    ci: 0,
    onboarding: false,
    editId: '',
    isEdit: false,
  },

  onLoad(query) {
    this._accountLoaded = false
    const onboarding = query && (query.onboarding === '1' || query.onboarding === 'true')
    const editId = (query && query.id) || ''
    this.setData({
      onboarding: !!onboarding,
      editId,
      isEdit: !!editId,
    })
    if (onboarding) {
      wx.setNavigationBarTitle({ title: '创建第一个账户' })
    } else if (editId) {
      wx.setNavigationBarTitle({ title: '编辑账户' })
    }
  },

  onShow() {
    auth.requireLogin()
    if (this.data.editId && !this._accountLoaded) {
      this._accountLoaded = true
      this.loadAccount()
    }
  },

  async loadAccount() {
    wx.showLoading({ title: '加载中' })
    try {
      const data = await callCloud('account', { action: 'get', id: this.data.editId })
      const a = data.account
      if (!a) throw new Error('账户不存在')
      let bankIndex = BANKS.indexOf(a.bank || '')
      if (bankIndex < 0) {
        bankIndex = BANKS.length - 1
      }
      const ci = Math.max(0, this.data.currencies.indexOf(a.currency || 'CNY'))
      this.setData({
        type: a.type || 'savings',
        name: a.name || '',
        bank: a.bank || '',
        bankIndex,
        balance: String(a.balance != null ? a.balance : ''),
        creditLimit: String(a.creditLimit != null ? a.creditLimit : ''),
        ci: ci >= 0 ? ci : 0,
      })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    } finally {
      wx.hideLoading()
    }
  },

  skipOnboarding() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onType(e) {
    if (this.data.isEdit) return
    this.setData({ type: e.detail.value })
  },
  onName(e) {
    this.setData({ name: e.detail.value })
  },
  onBankPick(e) {
    const bankIndex = Number(e.detail.value) || 0
    const last = BANKS.length - 1
    const bank = bankIndex === last ? this.data.bank : BANKS[bankIndex] || ''
    this.setData({ bankIndex, bank })
  },
  onBankInput(e) {
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
    const {
      type,
      name,
      bank,
      balance,
      creditLimit,
      currencies,
      ci,
      editId,
      isEdit,
    } = this.data
    if (!name.trim()) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    wx.showLoading({ title: isEdit ? '保存中' : '创建中' })
    try {
      if (isEdit && editId) {
        await callCloud('account', {
          action: 'update',
          id: editId,
          name: name.trim(),
          bank,
          balance: Number(balance) || 0,
        })
        if (type === 'credit') {
          await callCloud('account', {
            action: 'updateCreditLimit',
            id: editId,
            creditLimit: Number(creditLimit) || 0,
          })
        }
        wx.hideLoading()
        wx.showToast({ title: '已保存', icon: 'success' })
        wx.navigateBack()
        return
      }

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
      if (this.data.onboarding) {
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' })
        }, 400)
      } else {
        wx.navigateBack()
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    }
  },
})
