const { callCloud } = require('../../utils/request.js')
const { formatMoneySafe, fetchHideAmount } = require('../../utils/format.js')
const auth = require('../../utils/auth.js')

Page({
  data: {
    i18n: {},
    regions: [],
    ri: 0,
    gross: '',
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1,
    previewMonthOptions: [12, 18, 24],
    previewMonthIndex: 1,
    yearOptions: [],
    yearIndex: 1,
    monthOptions: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    result: null,
    plans: [],
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadI18n()
    this.initDateOptions()
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
        startYear: t('salary.startYear'),
        startMonth: t('salary.startMonth'),
        previewMonths: t('salary.previewMonths'),
        forecastTitle: t('salary.forecastTitle'),
        forecastSubtitle: t('salary.forecastSubtitle'),
        monthGross: t('salary.monthGross'),
        monthTax: t('salary.monthTax'),
        monthNet: t('salary.monthNet'),
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

  initDateOptions() {
    const currentYear = new Date().getFullYear()
    const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]
    const yearIndex = Math.max(0, yearOptions.indexOf(this.data.startYear))
    this.setData({ yearOptions, yearIndex })
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

  onStartYear(e) {
    const idx = Number(e.detail.value) || 0
    const year = this.data.yearOptions[idx]
    this.setData({ yearIndex: idx, startYear: year })
  },

  onStartMonth(e) {
    const idx = Number(e.detail.value) || 0
    this.setData({ startMonth: idx + 1 })
  },

  onPreviewMonths(e) {
    const idx = Number(e.detail.value) || 0
    this.setData({ previewMonthIndex: idx })
  },

  async calc() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const { regions, ri, gross, startYear, startMonth, previewMonthOptions, previewMonthIndex } = this.data
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
        startYear,
        startMonth,
        previewMonths: previewMonthOptions[previewMonthIndex] || 18,
      })
      const forecast = (data.forecast || []).map((item) => ({
        ...item,
        monthLabel: `${item.year}-${String(item.month).padStart(2, '0')}`,
        grossText: formatMoneySafe(item.gross),
        taxText: formatMoneySafe(item.monthlyTax),
        netText: formatMoneySafe(item.net),
      }))
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
          forecast,
          raw: data,
        },
      })
    } catch (e) {
      wx.showToast({ title: e.message || t('common.failed'), icon: 'none' })
    }
  },

  async savePlan() {
    const t = getApp().globalData.i18n.t.bind(getApp().globalData.i18n)
    const { regions, ri, gross, startYear, startMonth, previewMonthOptions, previewMonthIndex } = this.data
    const code = regions[ri] && regions[ri].code
    try {
      await callCloud('payroll', {
        action: 'savePlan',
        regionCode: code,
        grossSalary: Number(gross),
        startYear,
        startMonth,
        previewMonths: previewMonthOptions[previewMonthIndex] || 18,
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
