const { callCloud } = require('../../utils/request.js')
const { formatMoney } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

function normalizeGroupType(t) {
  if (t === 'savings') return 'bank'
  if (t === 'investment') return 'cash'
  return t
}

Page({
  data: {
    i18n: {},
    groups: [],
    groupsAll: [],
    filterKey: 'all',
    filterTabs: [],
    total: '',
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    this.load()
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)

    wx.setNavigationBarTitle({ title: t('accounts.title') })

    this.setData({
      i18n: {
        new: t('accounts.new'),
        noTypeAccounts: t('accounts.noTypeAccounts'),
        totalAssets: t('accounts.totalAssets'),
        limit: t('accounts.limit'),
        used: t('accounts.used'),
      },
      filterTabs: [
        { key: 'all', label: t('accounts.filterAll') },
        { key: 'cash', label: t('accounts.filterCash') },
        { key: 'bank', label: t('accounts.filterBank') },
        { key: 'wallet', label: t('accounts.filterWallet') },
        { key: 'credit', label: t('accounts.filterCredit') },
      ],
    })
  },

  async load() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const typeLabelMap = {
      cash: t('accounts.typeCash'),
      bank: t('accounts.typeBank'),
      wallet: t('accounts.typeWallet'),
      credit: t('accounts.typeCredit'),
      savings: t('accounts.typeSavings'),
      investment: t('accounts.typeInvestment'),
    }

    try {
      const data = await callCloud('account', { action: 'list' })
      const list = data.list || []
      let total = 0
      const currencySet = new Set()
      const byType = { bank: [], wallet: [], credit: [], cash: [] }
      list.forEach((a) => {
        const cur = a.currency || 'CNY'
        currencySet.add(cur)
        let displayBalance = ''
        let displayLimit = ''
        let displayUsed = ''
        if (a.type === 'credit') {
          const used = Number(a.balance || 0)
          const lim = Number(a.creditLimit || 0) + Number(a.tempLimit || 0)
          const avail = Math.max(0, lim - used)
          displayBalance = `${formatMoney(avail, cur)} ${t('accounts.available')}`
          displayLimit = formatMoney(lim, cur)
          displayUsed = formatMoney(used, cur)
          total += avail
        } else {
          const bal = Number(a.balance || 0)
          displayBalance = formatMoney(bal, cur)
          total += bal
        }
        const g = normalizeGroupType(a.type)
        const bucket = byType[g] || byType.cash
        bucket.push({
          ...a,
          displayBalance,
          displayLimit,
          displayUsed,
        })
      })
      const order = ['cash', 'bank', 'wallet', 'credit']
      const groups = order
        .filter((tKey) => byType[tKey].length)
        .map((tKey) => ({
          type: tKey,
          label: typeLabelMap[tKey] || tKey,
          list: byType[tKey],
        }))
      const totalStr =
        currencySet.size <= 1
          ? formatMoney(total, currencySet.size === 1 ? [...currencySet][0] : 'CNY')
          : t('accounts.multiCurrency')
      this.setData(
        {
          groupsAll: groups,
          total: totalStr,
        },
        () => this.applyFilter(),
      )
    } catch (e) {
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
    }
  },

  applyFilter() {
    const { groupsAll, filterKey } = this.data
    if (!groupsAll || !groupsAll.length) {
      this.setData({ groups: [] })
      return
    }
    const groups =
      filterKey === 'all' ? groupsAll : groupsAll.filter((g) => g.type === filterKey)
    this.setData({ groups })
  },

  onFilterTap(e) {
    const key = e.currentTarget.dataset.key || 'all'
    this.setData({ filterKey: key })
    this.applyFilter()
  },

  onAccTap(e) {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || t('accounts.pickAccount')
    if (!id) return
    wx.showActionSheet({
      itemList: [t('accounts.edit'), t('accounts.archive')],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/profile/accounts-new?id=' + id })
          return
        }
        if (res.tapIndex === 1) {
          wx.showModal({
            title: t('accounts.archiveTitle'),
            content: t('accounts.archiveConfirm', [name]),
            success: async (r) => {
              if (!r.confirm) return
              try {
                await callCloud('account', {
                  action: 'update',
                  id,
                  archived: true,
                })
                wx.showToast({ title: t('accounts.archived'), icon: 'success' })
                this.load()
              } catch (err) {
                wx.showToast({ title: err.message || t('common.failed'), icon: 'none' })
              }
            },
          })
        }
      },
    })
  },
})
