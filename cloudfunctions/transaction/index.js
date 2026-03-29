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

async function getAccount(col, id, openid) {
  const doc = await col.doc(id).get()
  if (!doc.data || doc.data.openid !== openid) return null
  if (doc.data.archived === true) return null
  return doc.data
}

function creditLimitTotal(acct) {
  return Number(acct.creditLimit || 0) + Number(acct.tempLimit || 0)
}

/** 支出后账户余额变化 */
function applyExpenseBalance(acct, amount) {
  const a = Number(amount)
  if (acct.type === 'credit') {
    return Number(acct.balance || 0) + a
  }
  return Number(acct.balance || 0) - a
}

/** 收入后账户余额变化 */
function applyIncomeBalance(acct, amount) {
  const a = Number(amount)
  if (acct.type === 'credit') {
    return Math.max(0, Number(acct.balance || 0) - a)
  }
  return Number(acct.balance || 0) + a
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail(401, '未授权')

  const action = event.action || 'daily'
  const accCol = db.collection('accounts')
  const txCol = db.collection('transactions')
  const now = db.serverDate()

  try {
    if (action === 'get') {
      const { id } = event
      if (!id) return fail(400, '缺少 id')
      const doc = await txCol.doc(id).get()
      if (!doc.data || doc.data.openid !== openid) return fail(404, '记录不存在')
      return ok({ transaction: doc.data })
    }

    if (action === 'daily') {
      const date = event.date
      if (!date) return fail(400, '缺少 date')
      const r = await txCol
        .where({ openid, date })
        .orderBy('createdAt', 'desc')
        .get()
      return ok({ list: r.data })
    }

    if (action === 'list') {
      const { startDate, endDate, limit = 100 } = event
      let q = txCol.where({ openid })
      if (startDate && endDate) {
        q = q.where({
          date: _.gte(startDate).and(_.lte(endDate)),
        })
      }
      const r = await q.orderBy('date', 'desc').orderBy('createdAt', 'desc').limit(limit).get()
      return ok({ list: r.data })
    }

    if (action === 'create') {
      const {
        type,
        amount,
        category,
        date,
        note = '',
        accountId,
        toAccountId,
        installmentPlanId,
      } = event
      const amt = Number(amount)
      if (!type || !amt || amt <= 0) return fail(400, '类型或金额无效')
      if (!date) return fail(400, '缺少日期')

      if (type === 'transfer') {
        const fromAccountId = event.fromAccountId || accountId
        const toAccId = event.toAccountId
        if (!fromAccountId || !toAccId || fromAccountId === toAccId) {
          return fail(400, '转账须指定 fromAccountId 与 toAccountId 且不能相同')
        }
        const from = await getAccount(accCol, fromAccountId, openid)
        const to = await getAccount(accCol, toAccId, openid)
        if (!from || !to) return fail(404, '账户不存在')
        if (from.type === 'credit') {
          const lim = creditLimitTotal(from)
          const used = Number(from.balance || 0)
          if (used + amt > lim) return fail(400, '转出额度不足')
        } else if (Number(from.balance || 0) < amt) {
          return fail(400, '转出余额不足')
        }
        const newFrom =
          from.type === 'credit'
            ? Number(from.balance || 0) + amt
            : Number(from.balance || 0) - amt
        const newTo =
          to.type === 'credit'
            ? Math.max(0, Number(to.balance || 0) - amt)
            : Number(to.balance || 0) + amt
        await accCol.doc(fromAccountId).update({
          data: { balance: newFrom, updatedAt: now },
        })
        await accCol.doc(toAccId).update({
          data: { balance: newTo, updatedAt: now },
        })
        const add = await txCol.add({
          data: {
            openid,
            type: 'transfer',
            amount: amt,
            category: '转账',
            date,
            note,
            accountId: fromAccountId,
            toAccountId: toAccId,
            installmentPlanId: installmentPlanId || '',
            createdAt: now,
            updatedAt: now,
          },
        })
        const doc = await txCol.doc(add._id).get()
        return ok({ transaction: doc.data })
      }

      if (type !== 'income' && type !== 'expense') {
        return fail(400, '类型错误')
      }
      if (!accountId || !category) return fail(400, '缺少账户或分类')
      const acct = await getAccount(accCol, accountId, openid)
      if (!acct) return fail(404, '账户不存在')

      let newBal
      if (type === 'expense') {
        if (acct.type !== 'credit' && Number(acct.balance || 0) < amt) {
          return fail(400, '余额不足')
        }
        newBal = applyExpenseBalance(acct, amt)
        if (acct.type === 'credit' && newBal > creditLimitTotal(acct)) {
          return fail(400, '超出信用额度')
        }
      } else {
        newBal = applyIncomeBalance(acct, amt)
      }

      await accCol.doc(accountId).update({
        data: { balance: newBal, updatedAt: now },
      })

      const add = await txCol.add({
        data: {
          openid,
          type,
          amount: amt,
          category,
          date,
          note,
          accountId,
          toAccountId: '',
          installmentPlanId: installmentPlanId || '',
          createdAt: now,
          updatedAt: now,
        },
      })
      const doc = await txCol.doc(add._id).get()
      return ok({ transaction: doc.data })
    }

    if (action === 'update') {
      const { id, amount, category, date, note } = event
      if (!id) return fail(400, '缺少 id')
      const cur = await txCol.doc(id).get()
      if (!cur.data || cur.data.openid !== openid) return fail(403, '无权操作')
      // 简化：不自动回滚旧余额，仅更新展示字段（生产应做差额调整）
      const patch = { updatedAt: now }
      if (amount !== undefined) patch.amount = Number(amount)
      if (category !== undefined) patch.category = category
      if (date !== undefined) patch.date = date
      if (note !== undefined) patch.note = note
      await txCol.doc(id).update({ data: patch })
      const doc = await txCol.doc(id).get()
      return ok({ transaction: doc.data })
    }

    if (action === 'delete') {
      const { id } = event
      if (!id) return fail(400, '缺少 id')
      const cur = await txCol.doc(id).get()
      if (!cur.data || cur.data.openid !== openid) return fail(403, '无权操作')
      // 简化：删除不回滚余额（可后续增强）
      await txCol.doc(id).remove()
      return ok({ removed: true })
    }

    return fail(400, '未知 action')
  } catch (e) {
    console.error(e)
    return fail(500, e.message || '错误')
  }
}
