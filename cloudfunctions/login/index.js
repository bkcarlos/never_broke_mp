const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function ok(data) {
  return { code: 0, message: 'ok', data }
}

function fail(code, message) {
  return { code, message, data: null }
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(401, '未授权')

  const nickName = event.nickName || '微信用户'
  const avatarUrl = event.avatarUrl || ''

  try {
    const col = db.collection('users')
    const res = await col.where({ openid }).limit(1).get()
    const now = db.serverDate()

    if (res.data.length === 0) {
      const addRes = await col.add({
        data: {
          openid,
          nickName,
          avatarUrl,
          phone: '',
          createdAt: now,
          updatedAt: now,
        },
      })
      const doc = await col.doc(addRes._id).get()
      return ok({ user: doc.data, isNewUser: true })
    }

    const id = res.data[0]._id
    await col.doc(id).update({
      data: {
        nickName,
        avatarUrl,
        updatedAt: now,
      },
    })
    const doc = await col.doc(id).get()
    return ok({ user: doc.data, isNewUser: false })
  } catch (e) {
    console.error(e)
    return fail(500, e.message || '登录失败')
  }
}
