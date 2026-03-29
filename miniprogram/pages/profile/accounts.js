const { callCloud } = require('../../utils/request.js')
const { formatMoney } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

const TYPE_LABEL = {
  cash: '现金',
  bank: '银行卡',
  wallet: '电子钱包',
  credit: '信用卡',
  savings: '储蓄卡',
  investment: '投资账户',
}

function normalizeGroupType(t) {
  if (t === 'savings') return 'bank'
  if (t === 'investment') return 'cash'
  return t
}

const FILTER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'cash', label: '现金' },
  { key: 'bank', label: '银行卡' },
  { key: 'wallet', label: '电子钱包' },
  { key: 'credit', label: '信用卡' },
]

Page({
  data: {
    groups: [],
    groupsAll: [],
    filterKey: 'all',
    filterTabs: FILTER_TABS,
    total: '',
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.load()
  },

  async load() {
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
          displayBalance = formatMoney(avail, cur) + ' 可用'
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
        .filter((t) => byType[t].length)
        .map((t) => ({
          type: t,
          label: TYPE_LABEL[t] || t,
          list: byType[t],
        }))
      const totalStr =
        currencySet.size <= 1
          ? formatMoney(total, currencySet.size === 1 ? [...currencySet][0] : 'CNY')
          : '多币种'
      this.setData(
        {
          groupsAll: groups,
          total: totalStr,
        },
        () => this.applyFilter(),
      )
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
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
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name || '账户'
    if (!id) return
    wx.showActionSheet({
      itemList: ['编辑', '归档（隐藏）'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/profile/accounts-new?id=' + id })
          return
        }
        if (res.tapIndex === 1) {
          wx.showModal({
            title: '归档账户',
            content: `确定归档「${name}」吗？归档后列表不再显示，历史账单仍保留。`,
            success: async (r) => {
              if (!r.confirm) return
              try {
                await callCloud('account', {
                  action: 'update',
                  id,
                  archived: true,
                })
                wx.showToast({ title: '已归档', icon: 'success' })
                this.load()
              } catch (err) {
                wx.showToast({ title: err.message || '失败', icon: 'none' })
              }
            },
          })
        }
      },
    })
  },
})
