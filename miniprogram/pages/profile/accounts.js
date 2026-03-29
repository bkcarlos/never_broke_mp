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
