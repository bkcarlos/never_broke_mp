const { callCloud } = require('../../utils/request.js')
const { formatMoneySafe, fetchHideAmount } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    i18n: {},
    regions: [],
    ri: 0,
    gross: '',
    result: null,
    plans: [],
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    fetchHideAmount().finally(() => {
      this.loadRegions()
      this.loadPlans()
    })
  },

  loadI18n() {
    const app = getApp()
    const t = app.globalData.i18n.t.bind(app.globalData.i18n)
    wx.setNavigationBarTitle({ title: t('salary.title') })
    this.setData({
      i18n: {
        calculatorTitle: t('salary.calculatorTitle'),
        grossSalary: t('salary.grossSalary'),
        calculate: t('salary.calculate'),
        labelGross: t('salary.labelGross'),
        labelPension: t('salary.labelPension'),
        labelMedical: t('salary.labelMedical'),
        labelUnemployment: t('salary.labelUnemployment'),
        labelHousing: t('salary.labelHousing'),
        labelIit: t('salary.labelIit'),
        labelNet: t('salary.labelNet'),
        saveAsPlan: t('salary.saveAsPlan'),
        myPlans: t('salary.myPlans'),
        netShort: t('salary.netShort'),
        remove: t('common.delete'),
      },
    })
  },

  async loadRegions() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    try {
      const data = await callCloud('payroll', { action: 'regions' })
      this.setData({ regions: data.list || [] })
    } catch (e) {
      wx.showToast({ title: e.message || t('common.loadFailed'), icon: 'none' })
    }
  },

  async loadPlans() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    try {
      const data = await callCloud('payroll', { action: 'getPlan' })
      const src = data.list || []
      const plans = []
      for (var i = 0; i < src.length; i++) {
        var p = src[i]
        plans.push(
          Object.assign({}, p, {
            displayNet: formatMoneySafe((p.result && p.result.net) || 0),
            netLine: t('salary.netShort') + ' ' + formatMoneySafe((p.result && p.result.net) || 0),
          }),
        )
      }
      this.setData({ plans })
    } catch (e) {
      /* ignore */
    }
  },

  onRegion(e) {
    this.setData({ ri: Number(e.detail.value) })
  },
  onGross(e) {
    this.setData({ gross: e.detail.value })
  },

  async calc() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const { regions, ri, gross } = this.data
    const g = Number(gross)
    const code = regions[ri] && regions[ri].code
    if (!code || !g) {
      wx.showToast({ title: t('salary.pickCityAndSalary'), icon: 'none' })
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
          gross: formatMoneySafe(data.gross),
          pension: formatMoneySafe(data.pension),
          medical: formatMoneySafe(data.medical),
          unemployment: formatMoneySafe(data.unemployment),
          housingFund: formatMoneySafe(data.housingFund),
          iit: formatMoneySafe(data.iit),
          net: formatMoneySafe(data.net),
          disclaimer: data.disclaimer,
          raw: data,
        },
      })
    } catch (e) {
      wx.showToast({ title: e.message || t('common.failed'), icon: 'none' })
    }
  },

  async savePlan() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const { regions, ri, gross } = this.data
    const code = regions[ri] && regions[ri].code
    try {
      await callCloud('payroll', {
        action: 'savePlan',
        regionCode: code,
        grossSalary: Number(gross),
      })
      wx.showToast({ title: t('common.saved'), icon: 'success' })
      this.loadPlans()
    } catch (e) {
      wx.showToast({ title: e.message || t('common.failed'), icon: 'none' })
    }
  },

  async removePlan(e) {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const id = e.currentTarget.dataset.id
    try {
      await callCloud('payroll', { action: 'deletePlan', id })
      wx.showToast({ title: t('common.deleted'), icon: 'success' })
      this.loadPlans()
    } catch (err) {
      wx.showToast({ title: err.message || t('common.failed'), icon: 'none' })
    }
  },
})
