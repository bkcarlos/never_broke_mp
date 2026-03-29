const { callCloud } = require('../../utils/request.js')
const { formatMoney } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    regions: [],
    ri: 0,
    gross: '',
    result: null,
    plans: [],
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadRegions()
    this.loadPlans()
  },

  async loadRegions() {
    try {
      const data = await callCloud('payroll', { action: 'regions' })
      this.setData({ regions: data.list || [] })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },

  async loadPlans() {
    try {
      const data = await callCloud('payroll', { action: 'getPlan' })
      const plans = (data.list || []).map((p) => ({
        ...p,
        displayNet: formatMoney((p.result && p.result.net) || 0),
      }))
      this.setData({ plans })
    } catch (e) {
      // ignore
    }
  },

  onRegion(e) {
    this.setData({ ri: Number(e.detail.value) })
  },
  onGross(e) {
    this.setData({ gross: e.detail.value })
  },

  async calc() {
    const { regions, ri, gross } = this.data
    const g = Number(gross)
    const code = regions[ri] && regions[ri].code
    if (!code || !g) {
      wx.showToast({ title: '请选择城市并输入工资', icon: 'none' })
      return
    }
    try {
      const data = await callCloud('payroll', {
        action: 'calculate',
        regionCode: code,
        grossSalary: g,
      })
      this.setData({
        result: {
          gross: formatMoney(data.gross),
          pension: formatMoney(data.pension),
          medical: formatMoney(data.medical),
          unemployment: formatMoney(data.unemployment),
          housingFund: formatMoney(data.housingFund),
          iit: formatMoney(data.iit),
          net: formatMoney(data.net),
          disclaimer: data.disclaimer,
          raw: data,
        },
      })
    } catch (e) {
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    }
  },

  async savePlan() {
    const { regions, ri, gross } = this.data
    const code = regions[ri] && regions[ri].code
    try {
      await callCloud('payroll', {
        action: 'savePlan',
        regionCode: code,
        grossSalary: Number(gross),
      })
      wx.showToast({ title: '已保存', icon: 'success' })
      this.loadPlans()
    } catch (e) {
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    }
  },

  async removePlan(e) {
    const id = e.currentTarget.dataset.id
    try {
      await callCloud('payroll', { action: 'deletePlan', id })
      wx.showToast({ title: '已删除', icon: 'success' })
      this.loadPlans()
    } catch (err) {
      wx.showToast({ title: err.message || '失败', icon: 'none' })
    }
  },
})
