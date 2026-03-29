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

      const dayTx = await txCol.where({ openid, date: today }).get()
      let todayExpense = 0
      let todayCount = 0
      dayTx.data.forEach((t) => {
        if (t.type === 'expense') {
          todayExpense += Number(t.amount || 0)
          todayCount += 1
        }
      })

      const monthTx = await txCol
        .where({
          openid,
          date: _.gte(start).and(_.lte(end)),
        })
        .get()
      let monthExpense = 0
      monthTx.data.forEach((t) => {
        if (t.type === 'expense') monthExpense += Number(t.amount || 0)
      })

      const b = await budgetCol
        .where({ openid, year: d.getFullYear(), month: d.getMonth() + 1 })
        .limit(1)
        .get()
      const budgetDoc = b.data[0]
      const totalBudget = budgetDoc ? Number(budgetDoc.totalBudget || 0) : 0

      const accs = await accCol.where({ openid, archived: _.neq(true) }).get()
      let totalAssets = 0
      const byType = { savings: 0, credit: 0, cash: 0, investment: 0 }
      accs.data.forEach((a) => {
        if (a.type === 'credit') {
          const avail = Number(a.creditLimit || 0) - Number(a.balance || 0)
          byType.credit += avail
          totalAssets += avail
        } else {
          const bal = Number(a.balance || 0)
          totalAssets += bal
          if (byType[a.type] !== undefined) byType[a.type] += bal
          else byType.cash += bal
        }
      })

      return ok({
        today: { expense: todayExpense, count: todayCount },
        budget: {
          used: monthExpense,
          total: totalBudget,
          remain: totalBudget - monthExpense,
          yearMonth: ym,
        },
        assets: {
          total: Math.round(totalAssets * 100) / 100,
          byType,
        },
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
      let income = 0
      let expense = 0
      r.data.forEach((t) => {
        if (t.type === 'income') income += Number(t.amount || 0)
        if (t.type === 'expense') expense += Number(t.amount || 0)
      })
      return ok({
        yearMonth: ym,
        income: Math.round(income * 100) / 100,
        expense: Math.round(expense * 100) / 100,
        balance: Math.round((income - expense) * 100) / 100,
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
      const map = {}
      let total = 0
      r.data.forEach((t) => {
        const c = t.category || '其他'
        const a = Number(t.amount || 0)
        map[c] = (map[c] || 0) + a
        total += a
      })
      const categories = Object.keys(map).map((k) => ({
        name: k,
        amount: Math.round(map[k] * 100) / 100,
        ratio: total ? Math.round((map[k] / total) * 1000) / 10 : 0,
      }))
      categories.sort((a, b) => b.amount - a.amount)
      return ok({ yearMonth: ym, totalExpense: Math.round(total * 100) / 100, categories })
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
        let exp = 0
        r.data.forEach((t) => {
          exp += Number(t.amount || 0)
        })
        list.push({ yearMonth: ym, expense: Math.round(exp * 100) / 100 })
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
