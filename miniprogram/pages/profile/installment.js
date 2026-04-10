const { callCloud } = require('../../utils/request.js')
const { formatMoneySafe, fetchHideAmount } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

function nextUnpaidIndex(schedule) {
  const sch = schedule || []
  const i = sch.findIndex((s) => !s.paid)
  return i >= 0 ? i + 1 : null
}

function formatScheduleText(schedule, t) {
  return (schedule || [])
    .map((s) => {
      const tag = s.paid ? '✓' : '○'
      return t('installment.scheduleLine', tag, String(s.index), s.date, formatMoneySafe(s.amount))
    })
    .join('\n')
}

Page({
  data: {
    formKey: 0,
    i18n: {},
    previewTotal: '',
    instOpts: ['3', '6', '12', '24'],
    instIdx: 1,
    preview: null,
    activePlans: [],
    donePlans: [],
  },

  onLoad() {
    this.setData({ formKey: (this.data.formKey || 0) + 1 })
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    fetchHideAmount().finally(() => this.loadPlans())
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    wx.setNavigationBarTitle({ title: t('installment.title') })
    this.setData({
      i18n: {
        previewTitle: t('installment.previewTitle'),
        periodsUnit: t('installment.periodsUnit'),
        previewPlanBtn: t('installment.previewPlanBtn'),
        activeSection: t('installment.activeSection'),
        noActivePlans: t('installment.noActivePlans'),
        viewSchedule: t('installment.viewSchedule'),
        markNextPaid: t('installment.markNextPaid'),
        completedSection: t('installment.completedSection'),
        completedStatus: t('installment.completedStatus'),
      },
    })
  },

  onPrevTotal(e) {
    this.setData({ previewTotal: e.detail.value })
  },

  pickInst(e) {
    const i = Number(e.currentTarget.dataset.i)
    if (!Number.isNaN(i)) this.setData({ instIdx: i })
  },

  async doPreview() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const total = Number(this.data.previewTotal)
    const ins = Number(this.data.instOpts[this.data.instIdx])
    if (!total || !ins) {
      wx.showToast({ title: t('installment.inputAmountHint'), icon: 'none' })
      return
    }
    try {
      const data = await callCloud('installment', {
        action: 'preview',
        totalAmount: total,
        installments: ins,
      })
      const perAmount = formatMoneySafe(data.perAmount)
      const summaryText = t('installment.previewSummary', perAmount, data.firstDate, data.lastDate)
      this.setData({
        preview: {
          perAmount,
          firstDate: data.firstDate,
          lastDate: data.lastDate,
          summaryText,
        },
      })
    } catch (e) {
      wx.showToast({ title: e.message || t('common.failed'), icon: 'none' })
    }
  },

  async loadPlans() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    try {
      const data = await callCloud('installment', { action: 'list' })
      const list = data.list || []
      const active = []
      const done = []
      list.forEach((p) => {
        const nextIdx = nextUnpaidIndex(p.schedule)
        const row = Object.assign({}, p, {
          totalAmountFmt: formatMoneySafe(p.totalAmount),
          nextIdx,
          badgePaid: t('installment.paidProgress', String(p.paidInstallments || 0), String(p.installments || 0)),
          totalLine: t('installment.totalWithAmount', formatMoneySafe(p.totalAmount)),
        })
        if (p.status === 'completed' || row.nextIdx === null) {
          done.push(row)
        } else {
          active.push(row)
        }
      })
      this.setData({ activePlans: active, donePlans: done })
    } catch (e) {
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
    }
  },

  showPlanDetail(e) {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const id = e.currentTarget.dataset.id
    const all = this.data.activePlans.concat(this.data.donePlans)
    const plan = all.find((p) => p._id === id)
    if (!plan) return
    const text = formatScheduleText(plan.schedule, t)
    wx.showModal({
      title: plan.title || t('installment.planDefaultTitle'),
      content: text || t('installment.noScheduleRows'),
      showCancel: false,
    })
  },

  async payNext(e) {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const id = e.currentTarget.dataset.id
    const plan = this.data.activePlans.find((p) => p._id === id)
    const idx = plan ? nextUnpaidIndex(plan.schedule) : null
    if (!idx) {
      wx.showToast({ title: t('installment.noPendingPeriod'), icon: 'none' })
      return
    }
    wx.showModal({
      title: t('installment.payConfirmTitle'),
      content: t('installment.payConfirmBody', String(idx)),
      success: async (r) => {
        if (!r.confirm) return
        try {
          await callCloud('installment', {
            action: 'pay',
            id,
            installmentIndex: idx,
          })
          wx.showToast({ title: t('common.updated'), icon: 'success' })
          this.loadPlans()
        } catch (err) {
          wx.showToast({ title: err.message || t('common.failed'), icon: 'none' })
        }
      },
    })
  },
})
