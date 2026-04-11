const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MONTHLY_STANDARD_DEDUCTION = 5000
const PREVIEW_MONTH_OPTIONS = [12, 18, 24]

function ok(data) {
  return { code: 0, message: 'ok', data }
}
function fail(code, message) {
  return { code, message, data: null }
}

/** 示例城市规则（仅供参考，非官方） */
const REGION_RULES = {
  beijing: {
    name: '北京',
    pensionRate: 0.08,
    medicalRate: 0.02,
    unemploymentRate: 0.005,
    housingFundRate: 0.12,
    injuryRate: 0,
    maternityRate: 0,
    baseCap: 31884,
    fundCap: 31884,
  },
  shanghai: {
    name: '上海',
    pensionRate: 0.08,
    medicalRate: 0.02,
    unemploymentRate: 0.005,
    housingFundRate: 0.07,
    injuryRate: 0,
    maternityRate: 0,
    baseCap: 34188,
    fundCap: 34188,
  },
  shenzhen: {
    name: '深圳',
    pensionRate: 0.08,
    medicalRate: 0.02,
    unemploymentRate: 0.003,
    housingFundRate: 0.13,
    injuryRate: 0,
    maternityRate: 0,
    baseCap: 31938,
    fundCap: 31938,
  },
}

/** 简化月度个税（速算扣除，示意） */
function calcIITMonthly(x) {
  if (x <= 0) return 0
  if (x <= 3000) return Math.round(x * 0.03 * 100) / 100
  if (x <= 12000) return Math.round((x * 0.1 - 210) * 100) / 100
  if (x <= 25000) return Math.round((x * 0.2 - 1410) * 100) / 100
  if (x <= 35000) return Math.round((x * 0.25 - 2660) * 100) / 100
  if (x <= 55000) return Math.round((x * 0.3 - 4410) * 100) / 100
  if (x <= 80000) return Math.round((x * 0.35 - 7160) * 100) / 100
  return Math.round((x * 0.45 - 15160) * 100) / 100
}

function calcCumulativeTax(x) {
  return calcIITMonthly(x)
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

function calcMonthlyContribution(gross, rule) {
  const base = Math.min(gross, rule.baseCap)
  const fundBase = Math.min(gross, rule.fundCap)
  const pension = round2(base * rule.pensionRate)
  const medical = round2(base * rule.medicalRate)
  const unemployment = round2(base * rule.unemploymentRate)
  const housing = round2(fundBase * rule.housingFundRate)
  const socialTotal = round2(pension + medical + unemployment + housing)
  return {
    pension,
    medical,
    unemployment,
    housingFund: housing,
    socialTotal,
  }
}

function normalizePreviewMonths(v) {
  const n = Number(v)
  return PREVIEW_MONTH_OPTIONS.includes(n) ? n : 18
}

function normalizeStartYear(v) {
  const n = Number(v)
  const nowYear = new Date().getFullYear()
  if (!n || n < nowYear - 1 || n > nowYear + 5) return nowYear
  return n
}

function normalizeStartMonth(v) {
  const n = Number(v)
  if (!n || n < 1 || n > 12) return new Date().getMonth() + 1
  return n
}

function buildMonthCursor(startYear, startMonth, offset) {
  const total = (startYear * 12 + (startMonth - 1)) + offset
  const year = Math.floor(total / 12)
  const month = total % 12 + 1
  return { year, month }
}

function buildSalaryForecast(gross, rule, startYear, startMonth, previewMonths) {
  const months = normalizePreviewMonths(previewMonths)
  let cumulativeGross = 0
  let cumulativeSocial = 0
  let cumulativeTax = 0
  const forecast = []

  for (let i = 0; i < months; i++) {
    const cursor = buildMonthCursor(startYear, startMonth, i)
    const monthly = calcMonthlyContribution(gross, rule)
    cumulativeGross = round2(cumulativeGross + gross)
    cumulativeSocial = round2(cumulativeSocial + monthly.socialTotal)
    const cumulativeDeduction = MONTHLY_STANDARD_DEDUCTION * (i + 1)
    const cumulativeTaxableIncome = Math.max(0, round2(cumulativeGross - cumulativeSocial - cumulativeDeduction))
    const cumulativeShouldTax = round2(calcCumulativeTax(cumulativeTaxableIncome))
    const monthlyTax = round2(Math.max(0, cumulativeShouldTax - cumulativeTax))
    cumulativeTax = cumulativeShouldTax
    const net = round2(gross - monthly.socialTotal - monthlyTax)

    forecast.push({
      year: cursor.year,
      month: cursor.month,
      gross: round2(gross),
      pension: monthly.pension,
      medical: monthly.medical,
      unemployment: monthly.unemployment,
      housingFund: monthly.housingFund,
      socialTotal: monthly.socialTotal,
      cumulativeGross,
      cumulativeDeduction,
      cumulativeSocial,
      cumulativeTaxableIncome,
      cumulativeTax: cumulativeShouldTax,
      monthlyTax,
      net,
    })
  }

  return forecast
}

function calcSalary(gross, rule, startYear, startMonth, previewMonths) {
  const forecast = buildSalaryForecast(gross, rule, startYear, startMonth, previewMonths)
  const current = forecast[0]
  return {
    gross: current.gross,
    pension: current.pension,
    medical: current.medical,
    unemployment: current.unemployment,
    housingFund: current.housingFund,
    socialTotal: current.socialTotal,
    taxableIncome: current.cumulativeTaxableIncome,
    iit: current.monthlyTax,
    net: current.net,
    startYear,
    startMonth,
    previewMonths: forecast.length,
    forecast,
    disclaimer: '计算结果仅供参考，以实际扣缴为准',
  }
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail(401, '未授权')

  const action = event.action || 'regions'
  const planCol = db.collection('salary_plans')
  const now = db.serverDate()

  try {
    if (action === 'regions') {
      const list = Object.keys(REGION_RULES).map((code) => ({
        code,
        name: REGION_RULES[code].name,
      }))
      return ok({ list })
    }

    if (action === 'rule') {
      const code = event.code
      const rule = REGION_RULES[code]
      if (!rule) return fail(404, '城市不存在')
      return ok({ code, rule })
    }

    if (action === 'calculate') {
      const { regionCode, grossSalary, startYear, startMonth, previewMonths } = event
      const gross = Number(grossSalary)
      const rule = REGION_RULES[regionCode]
      if (!rule || !gross || gross <= 0) return fail(400, '参数无效')
      const normalizedYear = normalizeStartYear(startYear)
      const normalizedMonth = normalizeStartMonth(startMonth)
      const normalizedPreviewMonths = normalizePreviewMonths(previewMonths)
      return ok(calcSalary(gross, rule, normalizedYear, normalizedMonth, normalizedPreviewMonths))
    }

    if (action === 'savePlan') {
      const { regionCode, grossSalary, title, startYear, startMonth, previewMonths } = event
      const gross = Number(grossSalary)
      const rule = REGION_RULES[regionCode]
      if (!rule || !gross) return fail(400, '参数无效')
      const normalizedYear = normalizeStartYear(startYear)
      const normalizedMonth = normalizeStartMonth(startMonth)
      const normalizedPreviewMonths = normalizePreviewMonths(previewMonths)
      const result = calcSalary(gross, rule, normalizedYear, normalizedMonth, normalizedPreviewMonths)
      const add = await planCol.add({
        data: {
          openid,
          title: title || `${rule.name}-${normalizedYear}年${normalizedMonth}月入职-月薪${gross}`,
          regionCode,
          grossSalary: gross,
          startYear: normalizedYear,
          startMonth: normalizedMonth,
          previewMonths: normalizedPreviewMonths,
          result,
          forecast: result.forecast,
          createdAt: now,
          updatedAt: now,
        },
      })
      const doc = await planCol.doc(add._id).get()
      return ok({ plan: doc.data })
    }

    if (action === 'getPlan') {
      const r = await planCol.where({ openid }).orderBy('createdAt', 'desc').get()
      return ok({ list: r.data })
    }

    if (action === 'deletePlan') {
      const { id } = event
      if (!id) return fail(400, '缺少 id')
      const doc = await planCol.doc(id).get()
      if (!doc.data || doc.data.openid !== openid) return fail(403, '无权操作')
      await planCol.doc(id).remove()
      return ok({ removed: true })
    }

    return fail(400, '未知 action')
  } catch (e) {
    console.error(e)
    return fail(500, e.message || '错误')
  }
}
