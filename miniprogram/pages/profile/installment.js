const { callCloud } = require('../../utils/request.js')
const { formatMoney } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    previewTotal: '',
    instOpts: ['3', '6', '12', '24'],
    instIdx: 1,
    preview: null,
    plans: [],
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadPlans()
  },

  onPrevTotal(e) {
    this.setData({ previewTotal: e.detail.value })
  },
  onInstPick(e) {
    this.setData({ instIdx: Number(e.detail.value) })
  },

  async doPreview() {
    const total = Number(this.data.previewTotal)
    const ins = Number(this.data.instOpts[this.data.instIdx])
    if (!total || !ins) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }
    try {
      const data = await callCloud('installment', {
        action: 'preview',
        totalAmount: total,
        installments: ins,
      })
      this.setData({
        preview: {
          perAmount: formatMoney(data.perAmount),
          firstDate: data.firstDate,
          lastDate: data.lastDate,
        },
      })
    } catch (e) {
      wx.showToast({ title: e.message || '失败', icon: 'none' })
    }
  },

  async loadPlans() {
    try {
      const data = await callCloud('installment', { action: 'list' })
      const plans = (data.list || []).map((p) => ({
        ...p,
        totalAmount: formatMoney(p.totalAmount),
      }))
      this.setData({ plans })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },
})
