const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function ok(data) {
  return { code: 0, message: 'ok', data }
}
function fail(code, message) {
  return { code, message, data: null }
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function compareDate(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

function normalizeCurrency(currency) {
  return currency || 'CNY'
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail(401, '未授权')

  try {
    const days = Number(event.days || 30)
    const safetyLine = Number(event.safetyLine || 0)
    const accCol = db.collection('accounts')
    const txCol = db.collection('transactions')
    const recCol = db.collection('recurring_incomes')
    const insCol = db.collection('installment_plans')

    const accs = await accCol.where({ openid, archived: _.neq(true) }).get()
    const balancesByCurrency = {}
    accs.data.forEach((a) => {
      const currency = normalizeCurrency(a.currency)
      if (!balancesByCurrency[currency]) balancesByCurrency[currency] = 0
      if (a.type === 'credit') {
        const lim = Number(a.creditLimit || 0) + Number(a.tempLimit || 0)
        balancesByCurrency[currency] += Math.max(0, lim - Number(a.balance || 0))
      } else {
        balancesByCurrency[currency] += Number(a.balance || 0)
      }
    })

    const currencies = Object.keys(balancesByCurrency)
    const primaryCurrency = event.currency || (currencies.length === 1 ? currencies[0] : '')
    if (!primaryCurrency) {
      return ok({
        multiCurrency: currencies.length > 1,
        currencies,
        currentBalanceByCurrency: Object.keys(balancesByCurrency).reduce((acc, currency) => {
          acc[currency] = round2(balancesByCurrency[currency])
          return acc
        }, {}),
        unsupportedMixedCurrency: true,
        message: '检测到多币种账户，现金流预测暂不支持跨币种混算，请按单一币种查看。',
        horizonDays: days,
        series: [],
        risks: [],
      })
    }

    const baseBalance = Number(balancesByCurrency[primaryCurrency] || 0)
    const today = new Date().toISOString().slice(0, 10)
    const from30 = addDays(today, -30)
    const pastTx = await txCol
      .where({
        openid,
        type: 'expense',
        currency: primaryCurrency,
        date: _.gte(from30).and(_.lte(today)),
      })
      .get()
    let expenseSum = 0
    pastTx.data.forEach((t) => {
      expenseSum += Number(t.amount || 0)
    })
    const avgDailyExpense = expenseSum / 30 || 0

    const recurring = await recCol.where({ openid, currency: primaryCurrency }).get()
    const installments = await insCol.where({ openid, status: 'active', currency: primaryCurrency }).get()

    const dailyMap = {}
    for (let i = 0; i <= days; i++) {
      const ds = addDays(today, i)
      dailyMap[ds] = { date: ds, inflow: 0, outflow: 0 }
    }

    recurring.data.forEach((item) => {
      let d = item.nextDueDate
      while (compareDate(d, today) < 0) {
        const [y, m, dd] = d.split('-').map(Number)
        const dt = new Date(y, m - 1, dd)
        if (item.frequency === 'weekly') dt.setDate(dt.getDate() + 7)
        else if (item.frequency === 'monthly') dt.setMonth(dt.getMonth() + 1)
        else if (item.frequency === 'yearly') dt.setFullYear(dt.getFullYear() + 1)
        d = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      }
      while (compareDate(d, addDays(today, days)) <= 0) {
        if (dailyMap[d]) dailyMap[d].inflow += Number(item.amount || 0)
        const [y, m, dd] = d.split('-').map(Number)
        const dt = new Date(y, m - 1, dd)
        if (item.frequency === 'weekly') dt.setDate(dt.getDate() + 7)
        else if (item.frequency === 'monthly') dt.setMonth(dt.getMonth() + 1)
        else if (item.frequency === 'yearly') dt.setFullYear(dt.getFullYear() + 1)
        d = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      }
    })

    installments.data.forEach((plan) => {
      ;(plan.schedule || []).forEach((s) => {
        if (!s.paid && dailyMap[s.date]) {
          dailyMap[s.date].outflow += Number(s.amount || 0)
        }
      })
    })

    const series = []
    let bal = baseBalance
    let minBal = bal
    let minDay = today
    for (let i = 0; i <= days; i++) {
      const ds = addDays(today, i)
      const day = dailyMap[ds]
      const baseOut = i === 0 ? 0 : avgDailyExpense
      bal = bal + day.inflow - day.outflow - baseOut
      series.push({
        date: ds,
        balance: round2(bal),
        inflow: round2(day.inflow),
        outflow: round2(day.outflow + baseOut),
      })
      if (bal < minBal) {
        minBal = bal
        minDay = ds
      }
    }

    const risks = []
    if (safetyLine > 0) {
      series.forEach((p) => {
        if (p.balance < safetyLine) {
          risks.push({ date: p.date, balance: p.balance, message: '低于安全线' })
        }
      })
    }

    return ok({
      multiCurrency: currencies.length > 1,
      currencies,
      currency: primaryCurrency,
      currentBalanceByCurrency: Object.keys(balancesByCurrency).reduce((acc, currency) => {
        acc[currency] = round2(balancesByCurrency[currency])
        return acc
      }, {}),
      currentBalance: round2(baseBalance),
      avgDailyExpense: round2(avgDailyExpense),
      horizonDays: days,
      series,
      minBalance: round2(minBal),
      minBalanceDate: minDay,
      safetyLine,
      risks: risks.slice(0, 5),
    })
  } catch (e) {
    console.error(e)
    return fail(500, e.message || '错误')
  }
}
