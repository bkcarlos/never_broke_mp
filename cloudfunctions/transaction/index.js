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

function cloneAccount(acct) {
  return {
    ...acct,
    balance: Number(acct.balance || 0),
  }
}

function applyTransactionToAccount(acct, tx) {
  const amount = Number(tx.amount || 0)
  if (tx.type === 'expense') {
    acct.balance = applyExpenseBalance(acct, amount)
    return
  }
  if (tx.type === 'income') {
    acct.balance = applyIncomeBalance(acct, amount)
    return
  }
}

function rollbackTransactionFromAccount(acct, tx) {
  const amount = Number(tx.amount || 0)
  if (tx.type === 'expense') {
    acct.balance = applyIncomeBalance(acct, amount)
    return
  }
  if (tx.type === 'income') {
    acct.balance = applyExpenseBalance(acct, amount)
    return
  }
}

function validateAccountBalanceAfterTransaction(acct, tx) {
  const amount = Number(tx.amount || 0)
  if (tx.type === 'expense') {
    if (acct.type === 'credit') {
      if (Number(acct.balance || 0) > creditLimitTotal(acct)) {
        return '超出信用额度'
      }
      return ''
    }
    if (Number(acct.balance || 0) < 0) {
      return '余额不足'
    }
    return ''
  }

  if (tx.type === 'transferOut') {
    if (acct.type === 'credit') {
      if (Number(acct.balance || 0) > creditLimitTotal(acct)) {
        return '转出额度不足'
      }
      return ''
    }
    if (Number(acct.balance || 0) < 0) {
      return '转出余额不足'
    }
    return ''
  }

  return ''
}

async function buildAccountMap(accCol, openid, accountIds) {
  const map = {}
  for (const id of accountIds) {
    if (!id) continue
    if (map[id]) continue
    const acct = await getAccount(accCol, id, openid)
    if (!acct) return null
    map[id] = cloneAccount(acct)
  }
  return map
}

function rollbackTransactionOnAccounts(accountMap, tx) {
  if (tx.type === 'transfer') {
    const from = accountMap[tx.accountId]
    const to = accountMap[tx.toAccountId]
    const amount = Number(tx.amount || 0)
    if (!from || !to) return '账户不存在'
    from.balance = applyIncomeBalance(from, amount)
    to.balance = applyExpenseBalance(to, amount)
    return ''
  }

  const acct = accountMap[tx.accountId]
  if (!acct) return '账户不存在'
  rollbackTransactionFromAccount(acct, tx)
  return ''
}

function applyTransactionOnAccounts(accountMap, tx) {
  if (tx.type === 'transfer') {
    const from = accountMap[tx.accountId]
    const to = accountMap[tx.toAccountId]
    const amount = Number(tx.amount || 0)
    if (!from || !to) return '账户不存在'
    if (tx.accountId === tx.toAccountId) return '转账须指定 fromAccountId 与 toAccountId 且不能相同'
    from.balance =
      from.type === 'credit'
        ? Number(from.balance || 0) + amount
        : Number(from.balance || 0) - amount
    to.balance =
      to.type === 'credit'
        ? Math.max(0, Number(to.balance || 0) - amount)
        : Number(to.balance || 0) + amount
    const fromError = validateAccountBalanceAfterTransaction(from, { type: 'transferOut', amount })
    if (fromError) return fromError
    return ''
  }

  const acct = accountMap[tx.accountId]
  if (!acct) return '账户不存在'
  applyTransactionToAccount(acct, tx)
  return validateAccountBalanceAfterTransaction(acct, tx)
}

async function persistAccountBalances(accCol, accountMap, now) {
  const ids = Object.keys(accountMap)
  for (const id of ids) {
    await accCol.doc(id).update({
      data: { balance: Number(accountMap[id].balance || 0), updatedAt: now },
    })
  }
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
            category: category || 'transfer',
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
      const {
        id,
        type,
        amount,
        category,
        date,
        note,
        accountId,
        fromAccountId,
        toAccountId,
        installmentPlanId,
      } = event
      if (!id) return fail(400, '缺少 id')
      const cur = await txCol.doc(id).get()
      if (!cur.data || cur.data.openid !== openid) return fail(403, '无权操作')

      const oldTx = cur.data
      const nextType = type !== undefined ? type : oldTx.type
      const nextAmount = amount !== undefined ? Number(amount) : Number(oldTx.amount)
      if (!nextType || !nextAmount || nextAmount <= 0) return fail(400, '类型或金额无效')

      const nextAccountId =
        nextType === 'transfer'
          ? fromAccountId || accountId || oldTx.accountId
          : accountId || oldTx.accountId
      const nextToAccountId =
        nextType === 'transfer'
          ? toAccountId || oldTx.toAccountId
          : ''
      const nextCategory =
        category !== undefined ? category : nextType === 'transfer' ? 'transfer' : oldTx.category
      const nextDate = date !== undefined ? date : oldTx.date
      const nextNote = note !== undefined ? note : oldTx.note
      const nextInstallmentPlanId =
        installmentPlanId !== undefined ? installmentPlanId : oldTx.installmentPlanId || ''

      if (!nextDate) return fail(400, '缺少日期')
      if (nextType !== 'income' && nextType !== 'expense' && nextType !== 'transfer') {
        return fail(400, '类型错误')
      }
      if (nextType === 'transfer') {
        if (!nextAccountId || !nextToAccountId || nextAccountId === nextToAccountId) {
          return fail(400, '转账须指定 fromAccountId 与 toAccountId 且不能相同')
        }
      } else if (!nextAccountId || !nextCategory) {
        return fail(400, '缺少账户或分类')
      }

      const accountMap = await buildAccountMap(accCol, openid, [
        oldTx.accountId,
        oldTx.toAccountId,
        nextAccountId,
        nextToAccountId,
      ])
      if (!accountMap) return fail(404, '账户不存在')

      const rollbackError = rollbackTransactionOnAccounts(accountMap, oldTx)
      if (rollbackError) return fail(404, rollbackError)

      const nextTx = {
        ...oldTx,
        type: nextType,
        amount: nextAmount,
        category: nextCategory,
        date: nextDate,
        note: nextNote,
        accountId: nextAccountId,
        toAccountId: nextToAccountId,
        installmentPlanId: nextInstallmentPlanId,
      }
      const applyError = applyTransactionOnAccounts(accountMap, nextTx)
      if (applyError) return fail(400, applyError)

      await persistAccountBalances(accCol, accountMap, now)

      await txCol.doc(id).update({
        data: {
          type: nextType,
          amount: nextAmount,
          category: nextCategory,
          date: nextDate,
          note: nextNote,
          accountId: nextAccountId,
          toAccountId: nextToAccountId,
          installmentPlanId: nextInstallmentPlanId,
          updatedAt: now,
        },
      })
      const doc = await txCol.doc(id).get()
      return ok({ transaction: doc.data })
    }

    if (action === 'delete') {
      const { id } = event
      if (!id) return fail(400, '缺少 id')
      const cur = await txCol.doc(id).get()
      if (!cur.data || cur.data.openid !== openid) return fail(403, '无权操作')

      const oldTx = cur.data
      const accountMap = await buildAccountMap(accCol, openid, [oldTx.accountId, oldTx.toAccountId])
      if (!accountMap) return fail(404, '账户不存在')

      const rollbackError = rollbackTransactionOnAccounts(accountMap, oldTx)
      if (rollbackError) return fail(404, rollbackError)

      await persistAccountBalances(accCol, accountMap, now)
      await txCol.doc(id).remove()
      return ok({ removed: true })
    }

    return fail(400, '未知 action')
  } catch (e) {
    console.error(e)
    return fail(500, e.message || '错误')
  }
}
