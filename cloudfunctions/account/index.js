const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const VALID_TYPES = ['cash', 'bank', 'wallet', 'credit']

const TYPE_LABEL_CN = {
  cash: '现金',
  bank: '银行卡',
  wallet: '电子钱包',
  credit: '信用卡',
  savings: '储蓄卡',
  investment: '投资账户',
}

function institutionDisplay(inst) {
  const s = String(inst || '').trim()
  const m = { wechat: '微信', alipay: '支付宝', other: '其他' }
  return m[s] || s
}

/** 展示名：机构/发卡行-账户类型-尾号（现金无机构时仅类型±尾号） */
function buildAccountDisplayName(type, institution, cardLast4) {
  const typeLabel = TYPE_LABEL_CN[type] || type || '账户'
  const inst = institutionDisplay(institution)
  const tail = cardLast4 ? String(cardLast4).trim() : ''
  if (type === 'cash') {
    return tail ? `${typeLabel}-${tail}` : typeLabel
  }
  if (!inst) {
    return tail ? `${typeLabel}-${tail}` : typeLabel
  }
  return tail ? `${inst}-${typeLabel}-${tail}` : `${inst}-${typeLabel}`
}

/** 仅用于接口返回：name 不落库，由 type/institution/cardLast4 即时组合 */
function withDisplayName(acc) {
  if (!acc) return acc
  const inst = acc.institution != null && acc.institution !== '' ? acc.institution : acc.bank
  const name = buildAccountDisplayName(acc.type, inst, acc.cardLast4)
  return Object.assign({}, acc, { name })
}

function ok(data) {
  return { code: 0, message: 'ok', data }
}
function fail(code, message) {
  return { code, message, data: null }
}

function normalizeCurrency(c) {
  const s = c != null ? String(c).trim() : ''
  return s || 'CNY'
}

function validateCardLast4(v) {
  if (v === undefined || v === null || v === '') return { ok: true, value: '' }
  const s = String(v).trim()
  if (!/^\d+$/.test(s)) return { ok: false, message: '尾号须为数字' }
  if (s.length < 2 || s.length > 4) return { ok: false, message: '尾号长度须为 2–4 位' }
  return { ok: true, value: s }
}

function resolveInstitution(event, existing) {
  const raw = event.institution != null ? event.institution : event.bank
  if (raw !== undefined && raw !== null) return String(raw).trim()
  if (existing && existing.institution != null) return String(existing.institution).trim()
  if (existing && existing.bank != null) return String(existing.bank).trim()
  return ''
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
      return ok({ list: r.data.map(withDisplayName) })
    }

    if (action === 'get') {
      const { id } = event
      if (!id) return fail(400, '缺少 id')
      const doc = await col.doc(id).get()
      if (!doc.data || doc.data.openid !== openid) return fail(404, '账户不存在')
      return ok({ account: withDisplayName(doc.data) })
    }

    if (action === 'create') {
      const {
        type,
        balance = 0,
        creditLimit = 0,
        tempLimit = 0,
        currency: currencyIn,
        cardLast4: cardRaw,
      } = event
      if (!type) return fail(400, '缺少类型')
      if (!VALID_TYPES.includes(type)) return fail(400, '账户类型无效')

      const institution = resolveInstitution(event, null)
      if (type === 'bank' || type === 'wallet' || type === 'credit') {
        if (!institution) return fail(400, '该类型须填写机构 institution')
      }

      if (type === 'cash') {
        // 仅用 openid 查询后在内存判断，避免 archived+复合条件缺索引导致 count 失败
        const existing = await col.where({ openid }).limit(500).get()
        const hasActiveCash = existing.data.some(
          (d) => d && d.type === 'cash' && d.archived !== true,
        )
        if (hasActiveCash) return fail(400, '已存在未归档现金账户')
      }

      const c4 = validateCardLast4(cardRaw)
      if (!c4.ok) return fail(400, c4.message)

      const currency = normalizeCurrency(currencyIn)

      const row = {
        openid,
        type,
        institution,
        bank: institution,
        balance: Number(balance) || 0,
        creditLimit: type === 'credit' ? Math.max(0, Number(creditLimit) || 0) : 0,
        tempLimit: type === 'credit' ? Math.max(0, Number(tempLimit) || 0) : 0,
        currency,
        cardLast4: c4.value,
        archived: false,
        createdAt: now,
        updatedAt: now,
      }
      const add = await col.add({ data: row })
      const doc = await col.doc(add._id).get()
      return ok({ account: withDisplayName(doc.data) })
    }

    if (action === 'update') {
      const { id, archived, balance, institution: instIn, bank, cardLast4: cardRaw } = event
      if (!id) return fail(400, '缺少 id')
      const cur = await col.doc(id).get()
      if (!cur.data || cur.data.openid !== openid) return fail(403, '无权操作')
      const patch = { updatedAt: now }
      if (balance !== undefined) patch.balance = Number(balance)
      if (archived !== undefined) patch.archived = !!archived
      if (instIn !== undefined || bank !== undefined) {
        const inst = resolveInstitution({ institution: instIn, bank }, cur.data)
        patch.institution = inst
        patch.bank = inst
      }
      if (cardRaw !== undefined) {
        const c4 = validateCardLast4(cardRaw)
        if (!c4.ok) return fail(400, c4.message)
        patch.cardLast4 = c4.value
      }

      await col.doc(id).update({ data: patch })
      const doc = await col.doc(id).get()
      return ok({ account: withDisplayName(doc.data) })
    }

    if (action === 'updateCreditLimit' || action === 'updateCreditLimits') {
      const { id } = event
      if (!id) return fail(400, '缺少 id')
      const cur = await col.doc(id).get()
      if (!cur.data || cur.data.openid !== openid) return fail(403, '无权操作')
      if (cur.data.type !== 'credit') return fail(400, '仅信用卡可调整额度')

      const patch = { updatedAt: now }
      if (event.creditLimit !== undefined) {
        const v = Number(event.creditLimit)
        if (Number.isNaN(v) || v < 0) return fail(400, 'creditLimit 须 >= 0')
        patch.creditLimit = v
      }
      if (event.tempLimit !== undefined) {
        const v = Number(event.tempLimit)
        if (Number.isNaN(v) || v < 0) return fail(400, 'tempLimit 须 >= 0')
        patch.tempLimit = v
      }
      if (Object.keys(patch).length <= 1) return fail(400, '请提供 creditLimit 或 tempLimit')

      await col.doc(id).update({ data: patch })
      const doc = await col.doc(id).get()
      return ok({ account: withDisplayName(doc.data) })
    }

    return fail(400, '未知 action')
  } catch (e) {
    console.error(e)
    return fail(500, e.message || '错误')
  }
}
