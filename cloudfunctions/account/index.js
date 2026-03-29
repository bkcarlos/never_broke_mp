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

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail(401, '未授权')

  const action = event.action || 'list'

  try {
    const col = db.collection('accounts')
    const now = db.serverDate()

    if (action === 'list') {
      const r = await col
        .where({ openid, archived: _.neq(true) })
        .orderBy('createdAt', 'desc')
        .get()
      return ok({ list: r.data })
    }

    if (action === 'get') {
      const { id } = event
      if (!id) return fail(400, '缺少 id')
      const doc = await col.doc(id).get()
      if (!doc.data || doc.data.openid !== openid) return fail(404, '账户不存在')
      return ok({ account: doc.data })
    }

    if (action === 'create') {
      const {
        name,
        type,
        bank = '',
        balance = 0,
        creditLimit = 0,
        currency = 'CNY',
      } = event
      if (!name || !type) return fail(400, '缺少名称或类型')
      const add = await col.add({
        data: {
          openid,
          name,
          type,
          bank,
          balance: Number(balance) || 0,
          creditLimit: Number(creditLimit) || 0,
          currency,
          archived: false,
          createdAt: now,
          updatedAt: now,
        },
      })
      const doc = await col.doc(add._id).get()
      return ok({ account: doc.data })
    }

    if (action === 'update') {
      const { id, name, bank, balance, archived } = event
      if (!id) return fail(400, '缺少 id')
      const cur = await col.doc(id).get()
      if (!cur.data || cur.data.openid !== openid) return fail(403, '无权操作')
      const patch = { updatedAt: now }
      if (name !== undefined) patch.name = name
      if (bank !== undefined) patch.bank = bank
      if (balance !== undefined) patch.balance = Number(balance)
      if (archived !== undefined) patch.archived = !!archived
      await col.doc(id).update({ data: patch })
      const doc = await col.doc(id).get()
      return ok({ account: doc.data })
    }

    if (action === 'updateCreditLimit') {
      const { id, creditLimit } = event
      if (!id) return fail(400, '缺少 id')
      const cur = await col.doc(id).get()
      if (!cur.data || cur.data.openid !== openid) return fail(403, '无权操作')
      await col.doc(id).update({
        data: {
          creditLimit: Number(creditLimit) || 0,
          updatedAt: now,
        },
      })
      const doc = await col.doc(id).get()
      return ok({ account: doc.data })
    }

    return fail(400, '未知 action')
  } catch (e) {
    console.error(e)
    return fail(500, e.message || '错误')
  }
}
