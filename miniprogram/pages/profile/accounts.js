const { callCloud } = require('../../utils/request.js')
const { formatMoney } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

const TYPE_LABEL = {
  savings: '储蓄卡',
  credit: '信用卡',
  cash: '现金',
  investment: '投资账户',
}

Page({
  data: {
    groups: [],
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
      const byType = { savings: [], credit: [], cash: [], investment: [] }
      list.forEach((a) => {
        let displayBalance = ''
        let displayLimit = ''
        let displayUsed = ''
        if (a.type === 'credit') {
          const used = Number(a.balance || 0)
          const lim = Number(a.creditLimit || 0)
          const avail = Math.max(0, lim - used)
          displayBalance = formatMoney(avail) + ' 可用'
          displayLimit = formatMoney(lim)
          displayUsed = formatMoney(used)
          total += avail
        } else {
          const bal = Number(a.balance || 0)
          displayBalance = formatMoney(bal)
          total += bal
        }
        const bucket = byType[a.type] || byType.cash
        bucket.push({
          ...a,
          displayBalance,
          displayLimit,
          displayUsed,
        })
      })
      const groups = ['savings', 'credit', 'cash', 'investment']
        .filter((t) => byType[t].length)
        .map((t) => ({
          type: t,
          label: TYPE_LABEL[t] || t,
          list: byType[t],
        }))
      this.setData({
        groups,
        total: formatMoney(total),
      })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
})
