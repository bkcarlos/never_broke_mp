const { callCloud } = require('../../utils/request.js')
const C = require('../../utils/constants.js')
const auth = require('../../utils/auth.js')

const { BANKS, WALLET_INSTITUTIONS, LEGACY_ACCOUNT_TYPES, CURRENCIES } = C

function mergeTypesForAccount(rawType) {
  const base = C.ACCOUNT_TYPES.slice()
  if (rawType === 'savings' || rawType === 'investment') {
    const has = base.some((t) => t.value === rawType)
    if (!has) {
      const leg = LEGACY_ACCOUNT_TYPES.find((t) => t.value === rawType)
      if (leg) base.push(leg)
    }
  }
  return base
}

/** 新建账户时的默认表单（避免页面实例复用后旧数据带入） */
function getDefaultCreateForm() {
  return {
    types: C.ACCOUNT_TYPES.slice(),
    type: 'cash',
    bank: '',
    bankIndex: 0,
    banks: BANKS,
    walletInstitutions: WALLET_INSTITUTIONS,
    walletInstIndex: 0,
    walletCustom: '',
    balance: '',
    creditLimit: '',
    tempLimit: '',
    cardLast4: '',
    currencies: CURRENCIES,
    ci: 0,
  }
}

Page({
  data: {
    types: C.ACCOUNT_TYPES,
    type: 'cash',
    bank: '',
    bankIndex: 0,
    banks: BANKS,
    walletInstitutions: WALLET_INSTITUTIONS,
    walletInstIndex: 0,
    walletCustom: '',
    balance: '',
    creditLimit: '',
    tempLimit: '',
    cardLast4: '',
    currencies: CURRENCIES,
    ci: 0,
    formKey: 0,
    onboarding: false,
    editId: '',
    isEdit: false,
  },

  onLoad(query) {
    this._accountLoaded = false
    const onboarding = query && (query.onboarding === '1' || query.onboarding === 'true')
    const editId = (query && query.id) || ''
    if (editId) {
      this.setData({
        onboarding: false,
        editId,
        isEdit: true,
      })
      wx.setNavigationBarTitle({ title: '编辑账户' })
      return
    }
    const fk = (this.data.formKey || 0) + 1
    const d = getDefaultCreateForm()
    d.formKey = fk
    d.onboarding = !!onboarding
    d.editId = ''
    d.isEdit = false
    this.setData(d)
    if (onboarding) wx.setNavigationBarTitle({ title: '创建第一个账户' })
    else wx.setNavigationBarTitle({ title: '新建账户' })
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
      const rawType = a.type || 'cash'
      const types = mergeTypesForAccount(rawType)
      const inst = (a.institution || a.bank || '').trim()
      let bankIndex = BANKS.indexOf(inst)
      if (bankIndex < 0) {
        bankIndex = BANKS.length - 1
      }
      let walletInstIndex = WALLET_INSTITUTIONS.findIndex((w) => w.value === inst)
      let walletCustom = ''
      if (walletInstIndex < 0) {
        walletInstIndex = WALLET_INSTITUTIONS.length - 1
        walletCustom = rawType === 'wallet' ? inst : ''
      }
      const ci = Math.max(0, this.data.currencies.indexOf(a.currency || 'CNY'))
      const hideTail = rawType === 'cash' || rawType === 'wallet'
      this.setData({
        types,
        type: rawType,
        bank: bankIndex === BANKS.length - 1 ? inst : BANKS[bankIndex] || '',
        bankIndex,
        walletInstIndex: Math.max(0, walletInstIndex),
        walletCustom,
        balance: String(a.balance != null ? a.balance : ''),
        creditLimit: String(a.creditLimit != null ? a.creditLimit : ''),
        tempLimit: String(a.tempLimit != null ? a.tempLimit : ''),
        cardLast4: hideTail ? '' : a.cardLast4 != null ? String(a.cardLast4) : '',
        ci: ci >= 0 ? ci : 0,
        formKey: (this.data.formKey || 0) + 1,
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

  onTypeTap(e) {
    if (this.data.isEdit) return
    const v = e.currentTarget.dataset.value
    if (!v) return
    const clearTail = v === 'cash' || v === 'wallet'
    if (clearTail) {
      this.setData({ type: v, cardLast4: '' })
    } else {
      this.setData({ type: v })
    }
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
  onWalletInstTap(e) {
    const idx = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(idx)) return
    this.setData({ walletInstIndex: idx })
  },
  onWalletCustom(e) {
    this.setData({ walletCustom: e.detail.value })
  },
  onCardLast4(e) {
    const v = (e.detail.value || '').replace(/\D/g, '').slice(0, 4)
    this.setData({ cardLast4: v })
  },
  onBal(e) {
    this.setData({ balance: e.detail.value })
  },
  onLimit(e) {
    this.setData({ creditLimit: e.detail.value })
  },
  onTempLimit(e) {
    this.setData({ tempLimit: e.detail.value })
  },
  onCurrencyTap(e) {
    const idx = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(idx)) return
    this.setData({ ci: idx })
  },

  resolveInstitution() {
    const { type, bank, bankIndex, walletInstIndex, walletCustom } = this.data
    if (type === 'cash') return ''
    if (type === 'wallet') {
      const w = WALLET_INSTITUTIONS[walletInstIndex]
      if (!w) return ''
      if (w.value === 'other') return (walletCustom || '').trim() || 'other'
      return w.value
    }
    const last = BANKS.length - 1
    if (bankIndex === last) return (bank || '').trim()
    return BANKS[bankIndex] || ''
  },

  validateBeforeSave() {
    const { type, cardLast4 } = this.data
    const inst = this.resolveInstitution()
    if (type === 'bank' || type === 'wallet' || type === 'credit') {
      if (!inst) {
        wx.showToast({ title: '请填写机构', icon: 'none' })
        return false
      }
    }
    const tail = type === 'cash' || type === 'wallet' ? '' : cardLast4
    if (tail && (tail.length < 2 || tail.length > 4)) {
      wx.showToast({ title: '尾号须为 2–4 位数字', icon: 'none' })
      return false
    }
    return true
  },

  async save() {
    const {
      type,
      balance,
      creditLimit,
      tempLimit,
      cardLast4,
      currencies,
      ci,
      editId,
      isEdit,
    } = this.data
    if (!this.validateBeforeSave()) return

    const institution = this.resolveInstitution()
    const cardLast4Out = type === 'cash' || type === 'wallet' ? '' : cardLast4 || ''
    wx.showLoading({ title: isEdit ? '保存中' : '创建中' })
    try {
      if (isEdit && editId) {
        await callCloud('account', {
          action: 'update',
          id: editId,
          institution,
          balance: Number(balance) || 0,
          cardLast4: cardLast4Out,
        })
        if (type === 'credit') {
          await callCloud('account', {
            action: 'updateCreditLimits',
            id: editId,
            creditLimit: Number(creditLimit) || 0,
            tempLimit: Number(tempLimit) || 0,
          })
        }
        wx.hideLoading()
        wx.showToast({ title: '已保存', icon: 'success' })
        wx.navigateBack()
        return
      }

      await callCloud('account', {
        action: 'create',
        type,
        institution,
        balance: Number(balance) || 0,
        creditLimit: type === 'credit' ? Number(creditLimit) || 0 : 0,
        tempLimit: type === 'credit' ? Number(tempLimit) || 0 : 0,
        currency: currencies[ci] || 'CNY',
        cardLast4: cardLast4Out,
      })
      const wasOnboarding = this.data.onboarding
      const d2 = getDefaultCreateForm()
      d2.formKey = (this.data.formKey || 0) + 1
      d2.onboarding = false
      d2.editId = ''
      d2.isEdit = false
      this.setData(d2)
      wx.hideLoading()
      wx.showToast({ title: '已创建', icon: 'success' })
      if (wasOnboarding) {
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' })
        }, 400)
      } else {
        wx.navigateBack()
      }
    } catch (e) {
      wx.hideLoading()
      const msg =
        (e && e.message) ||
        (typeof e === 'string' ? e : '') ||
        '失败'
      wx.showToast({ title: msg, icon: 'none' })
    }
  },
})
