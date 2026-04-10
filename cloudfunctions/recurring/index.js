const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function ok(data) {
  return { code: 0, message: 'ok', data }
}
function fail(code, message) {
  return { code, message, data: null }
}

function nextDueDate(freq, fromStr) {
  const [y, m, d] = fromStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (freq === 'weekly') dt.setDate(dt.getDate() + 7)
  else if (freq === 'monthly') dt.setMonth(dt.getMonth() + 1)
  else if (freq === 'yearly') dt.setFullYear(dt.getFullYear() + 1)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function compareDate(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

function addCalendarDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail(401, '未授权')

  const action = event.action || 'list'
  const col = db.collection('recurring_incomes')
  const now = db.serverDate()

  try {
    if (action === 'list') {
      const r = await col.where({ openid }).orderBy('nextDueDate', 'asc').get()
      return ok({ list: r.data })
    }

    if (action === 'create') {
      const { name, amount, frequency, startDate, accountId } = event
      const amt = Number(amount)
      if (!name || !amt || !frequency || !startDate || !accountId) {
        return fail(400, '缺少参数')
      }
      const nextDueDateStr = startDate
      const add = await col.add({
        data: {
          openid,
          name,
          amount: amt,
          frequency,
          nextDueDate: nextDueDateStr,
          accountId,
          createdAt: now,
          updatedAt: now,
        },
      })
      const doc = await col.doc(add._id).get()
      return ok({ item: doc.data })
    }

    if (action === 'due') {
      const today = new Date().toISOString().slice(0, 10)
      const r = await col.where({ openid }).get()
      const due = r.data.filter((x) => x.nextDueDate <= today)
      return ok({ list: due })
    }

    if (action === 'realize') {
      const { id } = event
      if (!id) return fail(400, '缺少 id')
      const doc = await col.doc(id).get()
      if (!doc.data || doc.data.openid !== openid) return fail(403, '无权操作')
      const item = doc.data
      const next = nextDueDate(item.frequency, item.nextDueDate)
      await col.doc(id).update({
        data: {
          nextDueDate: next,
          updatedAt: now,
        },
      })
      return ok({
        item: (await col.doc(id).get()).data,
        incomeRecorded: {
          amount: item.amount,
          accountId: item.accountId,
          category: 'salary',
          note: item.name,
        },
      })
    }

    if (action === 'delete') {
      const { id } = event
      if (!id) return fail(400, '缺少 id')
      const doc = await col.doc(id).get()
      if (!doc.data || doc.data.openid !== openid) return fail(403, '无权操作')
      await col.doc(id).remove()
      return ok({ removed: true })
    }

    if (action === 'projected') {
      const horizon = Number(event.days || 90)
      const today = new Date().toISOString().slice(0, 10)
      const end = addCalendarDays(today, horizon)
      const r = await col.where({ openid }).get()
      const projections = []
      r.data.forEach((item) => {
        let d = item.nextDueDate
        while (compareDate(d, today) < 0) {
          d = nextDueDate(item.frequency, d)
        }
        while (compareDate(d, end) <= 0) {
          projections.push({
            date: d,
            name: item.name,
            amount: item.amount,
            accountId: item.accountId,
          })
          d = nextDueDate(item.frequency, d)
        }
      })
      projections.sort((a, b) => compareDate(a.date, b.date))
      return ok({ projections })
    }

    return fail(400, '未知 action')
  } catch (e) {
    console.error(e)
    return fail(500, e.message || '错误')
  }
}
