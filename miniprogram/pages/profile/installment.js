const { callCloud } = require('../../utils/request.js')
const { formatMoney } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

function nextUnpaidIndex(schedule) {
  const sch = schedule || []
  const i = sch.findIndex((s) => !s.paid)
  return i >= 0 ? i + 1 : null
}

function formatScheduleText(schedule) {
  return (schedule || [])
    .map((s) => {
      const tag = s.paid ? '✓' : '○'
      return `${tag} 第${s.index}期 ${s.date}  ${formatMoney(s.amount)}`
    })
    .join('\n')
}

Page({
  data: {
    previewTotal: '',
    instOpts: ['3', '6', '12', '24'],
    instIdx: 1,
    preview: null,
    activePlans: [],
    donePlans: [],
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
      const list = data.list || []
      const active = []
      const done = []
      list.forEach((p) => {
        const row = {
          ...p,
          totalAmountFmt: formatMoney(p.totalAmount),
          nextIdx: nextUnpaidIndex(p.schedule),
        }
        if (p.status === 'completed' || row.nextIdx === null) {
          done.push(row)
        } else {
          active.push(row)
        }
      })
      this.setData({ activePlans: active, donePlans: done })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },

  showPlanDetail(e) {
    const id = e.currentTarget.dataset.id
    const all = [...this.data.activePlans, ...this.data.donePlans]
    const plan = all.find((p) => p._id === id)
    if (!plan) return
    const text = formatScheduleText(plan.schedule)
    wx.showModal({
      title: plan.title || '分期计划',
      content: text || '无明细',
      showCancel: false,
    })
  },

  async payNext(e) {
    const id = e.currentTarget.dataset.id
    const plan = this.data.activePlans.find((p) => p._id === id)
    const idx = plan ? nextUnpaidIndex(plan.schedule) : null
    if (!idx) {
      wx.showToast({ title: '无待还期数', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认还款',
      content: `将标记第 ${idx} 期为已还（可在明细中核对金额）。`,
      success: async (r) => {
        if (!r.confirm) return
        try {
          await callCloud('installment', {
            action: 'pay',
            id,
            installmentIndex: idx,
          })
          wx.showToast({ title: '已更新', icon: 'success' })
          this.loadPlans()
        } catch (err) {
          wx.showToast({ title: err.message || '失败', icon: 'none' })
        }
      },
    })
  },
})
