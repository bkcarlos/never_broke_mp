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

function monthRange(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number)
  const start = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(y, m, 0).getDate()
  const end = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
  return { start, end, y, m }
}

function normalizeCurrency(currency) {
  return currency || 'CNY'
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

function ensureCurrencyBucket(map, currency) {
  const code = normalizeCurrency(currency)
  if (!map[code]) {
    map[code] = {
      income: 0,
      expense: 0,
      balance: 0,
      totalExpense: 0,
      byType: { cash: 0, bank: 0, wallet: 0, credit: 0 },
      categories: {},
      months: {},
      todayExpense: 0,
      todayCount: 0,
      budgetTotal: 0,
    }
  }
  return map[code]
}

function toCurrencyTotals(currencyMap, picker) {
  const result = {}
  Object.keys(currencyMap).forEach((currency) => {
    result[currency] = picker(currencyMap[currency], currency)
  })
  return result
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail(401, '未授权')

  const action = event.action || 'homeOverview'
  const txCol = db.collection('transactions')
  const accCol = db.collection('accounts')
  const budgetCol = db.collection('budgets')

  try {
    if (action === 'homeOverview') {
      const today = new Date().toISOString().slice(0, 10)
      const d = new Date()
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const { start, end } = monthRange(ym)
      const settingsCol = db.collection('user_settings')

      const [dayTx, monthTx, b, accs, settingsRow] = await Promise.all([
        txCol.where({ openid, date: today }).get(),
        txCol
          .where({
            openid,
            date: _.gte(start).and(_.lte(end)),
          })
          .get(),
        budgetCol
          .where({ openid, year: d.getFullYear(), month: d.getMonth() + 1 })
          .limit(1)
          .get(),
        accCol.where({ openid, archived: _.neq(true) }).get(),
        settingsCol.where({ openid }).limit(1).get(),
      ])

      const currencyMap = {}

      dayTx.data.forEach((t) => {
        const bucket = ensureCurrencyBucket(currencyMap, t.currency)
        if (t.type === 'expense') {
          bucket.todayExpense += Number(t.amount || 0)
          bucket.todayCount += 1
        }
      })

      monthTx.data.forEach((t) => {
        const bucket = ensureCurrencyBucket(currencyMap, t.currency)
        if (t.type === 'expense') bucket.expense += Number(t.amount || 0)
      })

      const budgetDoc = b.data[0]
      if (budgetDoc) {
        ensureCurrencyBucket(currencyMap, budgetDoc.currency).budgetTotal = Number(budgetDoc.totalBudget || 0)
      }

      accs.data.forEach((a) => {
        const bucket = ensureCurrencyBucket(currencyMap, a.currency)
        if (a.type === 'credit') {
          const lim = Number(a.creditLimit || 0) + Number(a.tempLimit || 0)
          const avail = Math.max(0, lim - Number(a.balance || 0))
          bucket.byType.credit += avail
        } else {
          const bal = Number(a.balance || 0)
          const t = a.type === 'savings' ? 'bank' : a.type === 'investment' ? 'cash' : a.type
          if (bucket.byType[t] !== undefined) bucket.byType[t] += bal
          else bucket.byType.cash += bal
        }
      })

      const assetsByCurrency = toCurrencyTotals(currencyMap, (bucket) => {
        const byType = {
          cash: round2(bucket.byType.cash),
          bank: round2(bucket.byType.bank),
          wallet: round2(bucket.byType.wallet),
          credit: round2(bucket.byType.credit),
        }
        return {
          total: round2(byType.cash + byType.bank + byType.wallet + byType.credit),
          byType,
        }
      })

      const budgetByCurrency = toCurrencyTotals(currencyMap, (bucket) => ({
        used: round2(bucket.expense),
        total: round2(bucket.budgetTotal),
        remain: round2(bucket.budgetTotal - bucket.expense),
        yearMonth: ym,
      }))

      const todayByCurrency = toCurrencyTotals(currencyMap, (bucket) => ({
        expense: round2(bucket.todayExpense),
        count: bucket.todayCount,
      }))

      const currencies = Object.keys(currencyMap)
      const hideAmount = settingsRow.data[0] ? !!settingsRow.data[0].hideAmount : false

      return ok({
        hideAmount,
        currencies,
        multiCurrency: currencies.length > 1,
        today: todayByCurrency.CNY || { expense: 0, count: 0 },
        todayByCurrency,
        budget: budgetByCurrency.CNY || { used: 0, total: 0, remain: 0, yearMonth: ym },
        budgetByCurrency,
        assets: assetsByCurrency.CNY || { total: 0, byType: { cash: 0, bank: 0, wallet: 0, credit: 0 } },
        assetsByCurrency,
      })
    }

    if (action === 'monthlySummary' || action === 'summary') {
      let ym = event.yearMonth
      if (!ym) {
        const d = new Date()
        ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      }
      const { start, end } = monthRange(ym)
      const r = await txCol
        .where({
          openid,
          date: _.gte(start).and(_.lte(end)),
        })
        .get()
      const byCurrency = {}
      r.data.forEach((t) => {
        const bucket = ensureCurrencyBucket(byCurrency, t.currency)
        if (t.type === 'income') bucket.income += Number(t.amount || 0)
        if (t.type === 'expense') bucket.expense += Number(t.amount || 0)
      })
      const currencies = Object.keys(byCurrency)
      const totals = toCurrencyTotals(byCurrency, (bucket) => ({
        income: round2(bucket.income),
        expense: round2(bucket.expense),
        balance: round2(bucket.income - bucket.expense),
      }))
      return ok({
        yearMonth: ym,
        currencies,
        multiCurrency: currencies.length > 1,
        totals,
        income: totals.CNY ? totals.CNY.income : 0,
        expense: totals.CNY ? totals.CNY.expense : 0,
        balance: totals.CNY ? totals.CNY.balance : 0,
      })
    }

    if (action === 'monthly' || action === 'category') {
      let ym = event.yearMonth
      if (!ym) {
        const d = new Date()
        ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      }
      const { start, end } = monthRange(ym)
      const r = await txCol
        .where({
          openid,
          type: 'expense',
          date: _.gte(start).and(_.lte(end)),
        })
        .get()
      const byCurrency = {}
      r.data.forEach((t) => {
        const bucket = ensureCurrencyBucket(byCurrency, t.currency)
        const c = t.category || '其他'
        const a = Number(t.amount || 0)
        bucket.categories[c] = (bucket.categories[c] || 0) + a
        bucket.totalExpense += a
      })
      const currencies = Object.keys(byCurrency)
      const totals = toCurrencyTotals(byCurrency, (bucket) => {
        const categories = Object.keys(bucket.categories).map((k) => ({
          name: k,
          amount: round2(bucket.categories[k]),
          ratio: bucket.totalExpense ? Math.round((bucket.categories[k] / bucket.totalExpense) * 1000) / 10 : 0,
        }))
        categories.sort((a, b) => b.amount - a.amount)
        return {
          totalExpense: round2(bucket.totalExpense),
          categories,
        }
      })
      return ok({
        yearMonth: ym,
        currencies,
        multiCurrency: currencies.length > 1,
        totals,
        totalExpense: totals.CNY ? totals.CNY.totalExpense : 0,
        categories: totals.CNY ? totals.CNY.categories : [],
      })
    }

    if (action === 'trend') {
      const months = Number(event.months || 6)
      const list = []
      const d = new Date()
      for (let i = months - 1; i >= 0; i--) {
        const dt = new Date(d.getFullYear(), d.getMonth() - i, 1)
        const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
        const { start, end } = monthRange(ym)
        const r = await txCol
          .where({
            openid,
            type: 'expense',
            date: _.gte(start).and(_.lte(end)),
          })
          .get()
        const monthByCurrency = {}
        r.data.forEach((t) => {
          const currency = normalizeCurrency(t.currency)
          monthByCurrency[currency] = (monthByCurrency[currency] || 0) + Number(t.amount || 0)
        })
        const currencies = Object.keys(monthByCurrency)
        list.push({
          yearMonth: ym,
          currencies,
          multiCurrency: currencies.length > 1,
          expensesByCurrency: toCurrencyTotals(monthByCurrency, (amount) => round2(amount)),
          expense: monthByCurrency.CNY ? round2(monthByCurrency.CNY) : 0,
        })
      }
      return ok({ list })
    }

    if (action === 'timelineDailySummary') {
      const { startDate, endDate } = event
      if (!startDate || !endDate) return fail(400, '缺少日期范围')
      const r = await txCol
        .where({
          openid,
          date: _.gte(startDate).and(_.lte(endDate)),
        })
        .get()
      const map = {}
      r.data.forEach((t) => {
        const ds = t.date
        if (t.type === 'transfer') return
        if (!map[ds]) map[ds] = { date: ds, income: 0, expense: 0, count: 0 }
        map[ds].count += 1
        if (t.type === 'income') map[ds].income += Number(t.amount || 0)
        if (t.type === 'expense') map[ds].expense += Number(t.amount || 0)
      })
      const list = Object.values(map).sort((a, b) => (a.date < b.date ? 1 : -1))
      return ok({ list })
    }

    if (action === 'timelineDailyDetail') {
      const { date } = event
      if (!date) return fail(400, '缺少 date')
      const r = await txCol.where({ openid, date }).orderBy('createdAt', 'desc').get()
      return ok({ list: r.data })
    }

    return fail(400, '未知 action')
  } catch (e) {
    console.error(e)
    return fail(500, e.message || '错误')
  }
}
