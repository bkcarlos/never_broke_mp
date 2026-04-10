const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function ok(data) {
  return { code: 0, message: 'ok', data }
}
function fail(code, message) {
  return { code, message, data: null }
}

const DEFAULTS = {
  language: 'zh-CN',
  hideAmount: false,
  defaultCurrency: 'CNY',
  notifyBudget: true,
  notifyInstallment: true,
  notifyRecurring: true,
  safetyLine: 0,
  notificationPrefs: {
    budget: { enabled: true, lastSentDate: '' },
    installment: { enabled: true, lastSentDate: '' },
    recurring: { enabled: true, lastSentDate: '' },
  },
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail(401, '未授权')

  const action = event.action || 'get'
  const col = db.collection('user_settings')
  const now = db.serverDate()

  try {
    if (action === 'get') {
      const r = await col.where({ openid }).limit(1).get()
      if (r.data.length === 0) {
        return ok({ settings: { ...DEFAULTS } })
      }
      return ok({ settings: { ...DEFAULTS, ...r.data[0], _id: r.data[0]._id } })
    }

    if (action === 'update') {
      const patch = { ...event }
      delete patch.action
      const r = await col.where({ openid }).limit(1).get()
      if (r.data.length === 0) {
        const add = await col.add({
          data: {
            openid,
            ...DEFAULTS,
            ...patch,
            updatedAt: now,
            createdAt: now,
          },
        })
        const doc = await col.doc(add._id).get()
        return ok({ settings: doc.data })
      }
      const id = r.data[0]._id
      await col.doc(id).update({
        data: {
          ...patch,
          updatedAt: now,
        },
      })
      const doc = await col.doc(id).get()
      return ok({ settings: { ...DEFAULTS, ...doc.data } })
    }

    return fail(400, '未知 action')
  } catch (e) {
    console.error(e)
    return fail(500, e.message || '错误')
  }
}
