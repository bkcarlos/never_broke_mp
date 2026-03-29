const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function ok(data) {
  return { code: 0, message: 'ok', data }
}
function fail(code, message) {
  return { code, message, data: null }
}

function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1 + n, d)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail(401, '未授权')

  const action = event.action || 'list'
  const col = db.collection('installment_plans')
  const now = db.serverDate()

  try {
    if (action === 'preview') {
      const total = Number(event.totalAmount)
      const installments = Number(event.installments)
      if (!total || !installments || installments < 1) {
        return fail(400, '参数无效')
      }
      const per = Math.round((total / installments) * 100) / 100
      const startDate = event.startDate || new Date().toISOString().slice(0, 10)
      const schedule = []
      for (let i = 0; i < installments; i++) {
        schedule.push({
          index: i + 1,
          date: addMonths(startDate, i),
          amount: i === installments - 1 ? Math.round((total - per * (installments - 1)) * 100) / 100 : per,
        })
      }
      return ok({ perAmount: per, schedule, firstDate: schedule[0].date, lastDate: schedule[schedule.length - 1].date })
    }

    if (action === 'create') {
      const {
        title = '分期',
        totalAmount,
        installments,
        startDate,
        accountId,
        expenseTransactionId,
      } = event
      const total = Number(totalAmount)
      const ins = Number(installments)
      if (!total || !ins || ins < 1) return fail(400, '参数无效')
      const start = startDate || new Date().toISOString().slice(0, 10)
      const per = Math.round((total / ins) * 100) / 100
      const schedule = []
      for (let i = 0; i < ins; i++) {
        schedule.push({
          index: i + 1,
          date: addMonths(start, i),
          amount: i === ins - 1 ? Math.round((total - per * (ins - 1)) * 100) / 100 : per,
          paid: false,
        })
      }
      const add = await col.add({
        data: {
          openid,
          title,
          totalAmount: total,
          installments: ins,
          paidInstallments: 0,
          startDate: start,
          accountId: accountId || '',
          expenseTransactionId: expenseTransactionId || '',
          schedule,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
      })
      const doc = await col.doc(add._id).get()
      return ok({ plan: doc.data })
    }

    if (action === 'list') {
      const r = await col.where({ openid }).orderBy('createdAt', 'desc').get()
      return ok({ list: r.data })
    }

    if (action === 'pay') {
      const { id, installmentIndex } = event
      if (!id) return fail(400, '缺少 id')
      const doc = await col.doc(id).get()
      if (!doc.data || doc.data.openid !== openid) return fail(403, '无权操作')
      const plan = doc.data
      const idx = Number(installmentIndex) - 1
      const sch = plan.schedule || []
      if (idx < 0 || idx >= sch.length) return fail(400, '期数无效')
      if (sch[idx].paid) return fail(400, '该期已还')
      sch[idx].paid = true
      const paidCount = sch.filter((s) => s.paid).length
      await col.doc(id).update({
        data: {
          schedule: sch,
          paidInstallments: paidCount,
          status: paidCount >= plan.installments ? 'completed' : 'active',
          updatedAt: now,
        },
      })
      const d2 = await col.doc(id).get()
      return ok({ plan: d2.data })
    }

    return fail(400, '未知 action')
  } catch (e) {
    console.error(e)
    return fail(500, e.message || '错误')
  }
}
