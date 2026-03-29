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

function ymParts(ym) {
  const [y, m] = ym.split('-').map(Number)
  return { year: y, month: m }
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail(401, '未授权')

  const action = event.action || 'get'
  const col = db.collection('budgets')
  const txCol = db.collection('transactions')
  const now = db.serverDate()

  try {
    let yearMonth = event.yearMonth || event.year_month
    if (!yearMonth) {
      const d = new Date()
      yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    const { year, month } = ymParts(yearMonth)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    if (action === 'get') {
      const r = await col.where({ openid, year, month }).limit(1).get()
      const budget = r.data[0] || null
      let used = 0
      const tx = await txCol
        .where({
          openid,
          type: 'expense',
          date: _.gte(start).and(_.lte(end)),
        })
        .get()
      tx.data.forEach((t) => {
        used += Number(t.amount || 0)
      })
      return ok({
        budget,
        yearMonth,
        totalBudget: budget ? Number(budget.totalBudget || 0) : 0,
        used,
        remain: budget ? Number(budget.totalBudget || 0) - used : 0,
      })
    }

    if (action === 'history') {
      const limit = Number(event.limit || 12)
      const r = await col.where({ openid }).get()
      const rows = r.data
        .map((b) => ({ ...b }))
        .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
        .slice(0, limit)
      const list = []
      for (const b of rows) {
        const start = `${b.year}-${String(b.month).padStart(2, '0')}-01`
        const lastDay = new Date(b.year, b.month, 0).getDate()
        const end = `${b.year}-${String(b.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        let used = 0
        const tx = await txCol
          .where({
            openid,
            type: 'expense',
            date: _.gte(start).and(_.lte(end)),
          })
          .get()
        tx.data.forEach((t) => {
          used += Number(t.amount || 0)
        })
        const total = Number(b.totalBudget || 0)
        const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
        list.push({
          yearMonth: `${b.year}-${String(b.month).padStart(2, '0')}`,
          totalBudget: total,
          used,
          pct,
          over: total > 0 && used > total,
        })
      }
      return ok({ list })
    }

    if (action === 'copyPrev') {
      let yearMonth = event.yearMonth
      if (!yearMonth) {
        const d = new Date()
        yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      }
      const { year, month } = ymParts(yearMonth)
      const py = month === 1 ? year - 1 : year
      const pm = month === 1 ? 12 : month - 1
      const r = await col.where({ openid, year: py, month: pm }).limit(1).get()
      if (r.data.length === 0) return fail(404, '上月无预算记录')
      const prev = r.data[0]
      const tb = Number(prev.totalBudget || 0)
      const alert80 = prev.alert80 !== false
      const alertOver = prev.alertOver !== false
      const cur = await col.where({ openid, year, month }).limit(1).get()
      if (cur.data.length === 0) {
        const add = await col.add({
          data: {
            openid,
            year,
            month,
            totalBudget: tb,
            alert80,
            alertOver,
            createdAt: now,
            updatedAt: now,
          },
        })
        const doc = await col.doc(add._id).get()
        return ok({ budget: doc.data, copiedFrom: `${py}-${String(pm).padStart(2, '0')}` })
      }
      const id = cur.data[0]._id
      await col.doc(id).update({
        data: {
          totalBudget: tb,
          alert80,
          alertOver,
          updatedAt: now,
        },
      })
      const doc = await col.doc(id).get()
      return ok({ budget: doc.data, copiedFrom: `${py}-${String(pm).padStart(2, '0')}` })
    }

    if (action === 'set') {
      const { totalBudget, alert80 = true, alertOver = true } = event
      const tb = Number(totalBudget)
      if (tb < 0) return fail(400, '预算无效')
      const r = await col.where({ openid, year, month }).limit(1).get()
      if (r.data.length === 0) {
        const add = await col.add({
          data: {
            openid,
            year,
            month,
            totalBudget: tb,
            alert80,
            alertOver,
            createdAt: now,
            updatedAt: now,
          },
        })
        const doc = await col.doc(add._id).get()
        return ok({ budget: doc.data })
      }
      const id = r.data[0]._id
      await col.doc(id).update({
        data: {
          totalBudget: tb,
          alert80,
          alertOver,
          updatedAt: now,
        },
      })
      const doc = await col.doc(id).get()
      return ok({ budget: doc.data })
    }

    return fail(400, '未知 action')
  } catch (e) {
    console.error(e)
    return fail(500, e.message || '错误')
  }
}
