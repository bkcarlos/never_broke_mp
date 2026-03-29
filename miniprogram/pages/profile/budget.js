const { callCloud } = require('../../utils/request.js')
const { formatMoney, currentYearMonth } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    yearMonth: '',
    totalBudget: '',
    usage: null,
  },

  onShow() {
    if (!auth.requireLogin()) return
    const ym = currentYearMonth()
    this.setData({ yearMonth: ym })
    this.load(ym)
  },

  async load(ym) {
    try {
      const data = await callCloud('budget', { action: 'get', yearMonth: ym })
      const total = data.totalBudget || 0
      const used = data.used || 0
      const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
      this.setData({
        totalBudget: total ? String(total) : '',
        usage: {
          used: formatMoney(used),
          total: formatMoney(total),
          pct,
        },
      })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },

  onBudget(e) {
    this.setData({ totalBudget: e.detail.value })
  },

  async save() {
    const tb = Number(this.data.totalBudget)
    if (tb < 0) {
      wx.showToast({ title: '预算无效', icon: 'none' })
      return
    }
    try {
      await callCloud('budget', {
        action: 'set',
        yearMonth: this.data.yearMonth,
        totalBudget: tb,
      })
      wx.showToast({ title: '已保存', icon: 'success' })
      this.load(this.data.yearMonth)
    } catch (e) {
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    }
  },
})
