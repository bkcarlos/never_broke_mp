const { callCloud } = require('../../utils/request.js')
const { formatMoney, currentYearMonth } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

const WARN_KEY = 'nb_budget_warn_ym'

Page({
  data: {
    yearMonth: '',
    totalBudget: '',
    usage: null,
    alert80: true,
    alertOver: true,
    history: [],
    barClass: '',
  },

  onShow() {
    if (!auth.requireLogin()) return
    const ym = currentYearMonth()
    this.setData({ yearMonth: ym })
    this.load(ym)
    this.loadHistory()
  },

  maybeAlertBudget(total, used, budgetDoc) {
    if (!total || total <= 0 || !budgetDoc) return
    const pct = Math.min(100, Math.round((used / total) * 100))
    const ym = this.data.yearMonth
    const last = wx.getStorageSync(WARN_KEY) || ''
    if (last === ym) return
    if (pct >= 100 && budgetDoc.alertOver !== false) {
      wx.setStorageSync(WARN_KEY, ym)
      wx.showModal({
        title: '预算提示',
        content: `本月支出已超过预算（${formatMoney(used)} / ${formatMoney(total)}）。`,
        showCancel: false,
      })
      return
    }
    if (pct >= 80 && budgetDoc.alert80 !== false) {
      wx.setStorageSync(WARN_KEY, ym)
      wx.showModal({
        title: '预算提示',
        content: `本月预算已使用约 ${pct}%，请注意控制支出。`,
        showCancel: false,
      })
    }
  },

  async load(ym) {
    try {
      const data = await callCloud('budget', { action: 'get', yearMonth: ym })
      const total = data.totalBudget || 0
      const used = data.used || 0
      const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
      let barClass = ''
      if (pct >= 100) barClass = 'danger'
      else if (pct >= 80) barClass = 'warn'
      else if (pct > 0) barClass = 'ok'
      const b = data.budget || {}
      this.setData({
        totalBudget: total ? String(total) : '',
        alert80: b.alert80 !== false,
        alertOver: b.alertOver !== false,
        usage: {
          used: formatMoney(used),
          total: formatMoney(total),
          pct,
        },
        barClass,
      })
      this.maybeAlertBudget(total, used, b)
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },

  async loadHistory() {
    try {
      const data = await callCloud('budget', { action: 'history', limit: 12 })
      const list = (data.list || []).map((row) => ({
        ...row,
        usedFmt: formatMoney(row.used),
        totalFmt: formatMoney(row.totalBudget),
        label: row.yearMonth + (row.over ? '（超支）' : ''),
      }))
      this.setData({ history: list })
    } catch (e) {
      /* ignore */
    }
  },

  onBudget(e) {
    this.setData({ totalBudget: e.detail.value })
  },

  toggleAlert80() {
    this.setData({ alert80: !this.data.alert80 })
  },

  toggleAlertOver() {
    this.setData({ alertOver: !this.data.alertOver })
  },

  async copyPrev() {
    try {
      await callCloud('budget', {
        action: 'copyPrev',
        yearMonth: this.data.yearMonth,
      })
      wx.showToast({ title: '已从上月复制', icon: 'success' })
      this.load(this.data.yearMonth)
      this.loadHistory()
    } catch (e) {
      wx.showToast({ title: e.message || '上月无预算', icon: 'none' })
    }
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
        alert80: this.data.alert80,
        alertOver: this.data.alertOver,
      })
      wx.showToast({ title: '已保存', icon: 'success' })
      wx.removeStorageSync(WARN_KEY)
      this.load(this.data.yearMonth)
      this.loadHistory()
    } catch (e) {
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    }
  },
})
