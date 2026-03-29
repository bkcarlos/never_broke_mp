const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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

function calcSalary(gross, rule) {
  const base = Math.min(gross, rule.baseCap)
  const pension = Math.round(base * rule.pensionRate * 100) / 100
  const medical = Math.round(base * rule.medicalRate * 100) / 100
  const unemployment = Math.round(base * rule.unemploymentRate * 100) / 100
  const fundBase = Math.min(gross, rule.fundCap)
  const housing = Math.round(fundBase * rule.housingFundRate * 100) / 100
  const socialTotal = pension + medical + unemployment + housing
  const taxable = Math.max(0, gross - socialTotal - 5000)
  const iit = calcIITMonthly(taxable)
  const net = Math.round((gross - socialTotal - iit) * 100) / 100
  return {
    gross,
    pension,
    medical,
    unemployment,
    housingFund: housing,
    socialTotal: Math.round(socialTotal * 100) / 100,
    taxableIncome: Math.round(taxable * 100) / 100,
    iit,
    net,
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
      const { regionCode, grossSalary } = event
      const gross = Number(grossSalary)
      const rule = REGION_RULES[regionCode]
      if (!rule || !gross || gross <= 0) return fail(400, '参数无效')
      return ok(calcSalary(gross, rule))
    }

    if (action === 'savePlan') {
      const { regionCode, grossSalary, title } = event
      const gross = Number(grossSalary)
      const rule = REGION_RULES[regionCode]
      if (!rule || !gross) return fail(400, '参数无效')
      const result = calcSalary(gross, rule)
      const add = await planCol.add({
        data: {
          openid,
          title: title || `${rule.name}-月薪${gross}`,
          regionCode,
          grossSalary: gross,
          result,
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
