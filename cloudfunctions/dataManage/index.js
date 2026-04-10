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

function parseCSVLine(line) {
  const cells = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQ = !inQ
    } else if ((ch === ',' && !inQ) || ch === '\r') {
      cells.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur.trim())
  return cells
}

function normalizeRow(rawRow, defaultAccountId, rowIndex) {
  const row = rawRow || {}
  const date = String(row.date || row.日期 || '').trim()
  const typeInput = String(row.type || row.类型 || 'expense').trim().toLowerCase()
  const category = String(row.category || row.分类 || '').trim()
  const note = String(row.note || row.备注 || '').trim()
  const accountId = String(row.accountId || row.accountid || row.账户ID || row.账户id || defaultAccountId || '').trim()
  const amountRaw = row.amount ?? row.金额 ?? ''
  const amountText = String(amountRaw).trim()

  let type = ''
  if (['收入', 'income'].includes(typeInput)) {
    type = 'income'
  } else if (['支出', 'expense'].includes(typeInput)) {
    type = 'expense'
  } else if (['转账', 'transfer'].includes(typeInput)) {
    type = 'transfer'
  }

  const amount = Number(amountText)
  const errors = []

  if (!date) {
    errors.push('缺少日期(date/日期)')
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push('日期格式错误，需为 YYYY-MM-DD')
  }

  if (!type) {
    errors.push('类型无效，仅支持 income/expense/transfer 或 收入/支出/转账')
  }

  if (!amountText) {
    errors.push('缺少金额(amount/金额)')
  } else if (Number.isNaN(amount)) {
    errors.push('金额不是有效数字')
  } else if (amount <= 0) {
    errors.push('金额必须大于 0')
  }

  if (!category) {
    errors.push('缺少分类(category/分类)')
  }

  if (!accountId) {
    errors.push('缺少账户ID(accountId/账户ID)')
  }

  return {
    rowIndex,
    raw: row,
    normalized: {
      date,
      type,
      amount,
      category,
      note,
      accountId,
    },
    errors,
  }
}

function buildDuplicateKey(item) {
  return [item.date, item.type, Number(item.amount).toFixed(2), item.category, item.accountId].join('|')
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  if (!openid) return fail(401, '未授权')

  const action = event.action || 'importPreview'
  const txCol = db.collection('transactions')
  const accCol = db.collection('accounts')
  const now = db.serverDate()

  try {
    if (action === 'importPreview') {
      const { csvText } = event
      if (!csvText || typeof csvText !== 'string') {
        return fail(400, '缺少 csvText（文件内容文本）')
      }
      const lines = csvText.split(/\n/).filter((l) => l.trim())
      if (lines.length < 2) return fail(400, 'CSV 行数不足')
      const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase())
      const rows = []
      for (let i = 1; i < Math.min(lines.length, 51); i++) {
        const cells = parseCSVLine(lines[i])
        const row = {}
        header.forEach((h, idx) => {
          row[h] = cells[idx] || ''
        })
        rows.push(row)
      }
      return ok({ count: lines.length - 1, preview: rows, header })
    }

    if (action === 'importExecute') {
      const { rows, csvText, defaultAccountId } = event
      if (!defaultAccountId) return fail(400, '缺少 defaultAccountId')
      const defaultAcc = await accCol.doc(defaultAccountId).get()
      if (!defaultAcc.data || defaultAcc.data.openid !== openid) return fail(403, '默认账户无效')

      let list = []
      if (Array.isArray(rows) && rows.length) {
        list = rows
      } else if (csvText && typeof csvText === 'string') {
        const lines = csvText.split(/\n/).filter((l) => l.trim())
        if (lines.length < 2) return fail(400, 'CSV 行数不足')
        const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase())
        for (let i = 1; i < lines.length; i++) {
          const cells = parseCSVLine(lines[i])
          const row = {}
          header.forEach((h, idx) => {
            row[h] = cells[idx] || ''
          })
          list.push(row)
        }
      } else {
        return fail(400, '缺少 rows 或 csvText')
      }

      const normalizedRows = list.map((row, index) => normalizeRow(row, defaultAccountId, index + 2))
      const candidateRows = []
      const failed = []
      const duplicateKeysInFile = new Set()
      const accountOwnershipCache = new Map()
      const validAccountIds = new Set([defaultAccountId])

      for (const item of normalizedRows) {
        if (item.errors.length) {
          failed.push({
            rowIndex: item.rowIndex,
            reason: item.errors.join('；'),
            raw: item.raw,
          })
          continue
        }

        const accountId = item.normalized.accountId
        if (accountOwnershipCache.has(accountId)) {
          if (!accountOwnershipCache.get(accountId)) {
            failed.push({
              rowIndex: item.rowIndex,
              reason: '账户无效或不属于当前用户',
              raw: item.raw,
            })
            continue
          }
        } else if (accountId === defaultAccountId) {
          accountOwnershipCache.set(accountId, true)
        } else {
          const accRes = await accCol.doc(accountId).get().catch(() => null)
          const isValid = !!(accRes && accRes.data && accRes.data.openid === openid)
          accountOwnershipCache.set(accountId, isValid)
          if (!isValid) {
            failed.push({
              rowIndex: item.rowIndex,
              reason: '账户无效或不属于当前用户',
              raw: item.raw,
            })
            continue
          }
        }

        validAccountIds.add(accountId)
        const dupKey = buildDuplicateKey(item.normalized)
        if (duplicateKeysInFile.has(dupKey)) {
          failed.push({
            rowIndex: item.rowIndex,
            reason: 'CSV 内存在重复记录',
            raw: item.raw,
          })
          continue
        }
        duplicateKeysInFile.add(dupKey)
        candidateRows.push(item)
      }

      const existingByKey = new Set()
      for (const accountId of validAccountIds) {
        const existing = await txCol
          .where({
            openid,
            accountId,
          })
          .field({ date: true, type: true, amount: true, category: true, accountId: true })
          .get()

        existing.data.forEach((tx) => {
          existingByKey.add(buildDuplicateKey(tx))
        })
      }

      const successDetails = []
      const skippedDetails = []

      for (const item of candidateRows) {
        const payload = item.normalized
        const dupKey = buildDuplicateKey(payload)
        if (existingByKey.has(dupKey)) {
          skippedDetails.push({
            rowIndex: item.rowIndex,
            reason: '数据库中已存在相同记录，已跳过',
            raw: item.raw,
          })
          continue
        }

        await txCol.add({
          data: {
            openid,
            type: payload.type,
            amount: payload.amount,
            category: payload.category,
            date: payload.date,
            note: payload.note,
            accountId: payload.accountId,
            toAccountId: '',
            installmentPlanId: '',
            createdAt: now,
            updatedAt: now,
          },
        })

        const balanceDelta = payload.type === 'income' ? payload.amount : payload.type === 'expense' ? -payload.amount : 0
        if (balanceDelta !== 0) {
          await accCol.doc(payload.accountId).update({
            data: {
              balance: _.inc(balanceDelta),
              updatedAt: now,
            },
          })
        }

        existingByKey.add(dupKey)
        successDetails.push({
          rowIndex: item.rowIndex,
          accountId: payload.accountId,
          type: payload.type,
          amount: payload.amount,
          date: payload.date,
          category: payload.category,
        })
      }

      return ok({
        summary: {
          total: list.length,
          success: successDetails.length,
          failed: failed.length,
          skipped: skippedDetails.length,
        },
        successDetails,
        failedDetails: failed,
        skippedDetails,
      })
    }

    if (action === 'exportGenerate') {
      const { startDate, endDate } = event
      if (!startDate || !endDate) return fail(400, '缺少日期范围')
      const r = await txCol
        .where({
          openid,
          date: _.gte(startDate).and(_.lte(endDate)),
        })
        .orderBy('date', 'asc')
        .get()
      const header = ['日期', '类型', '分类', '金额', '备注']
      const lines = [header.join(',')]
      r.data.forEach((t) => {
        const typeLabel = t.type === 'income' ? '收入' : t.type === 'expense' ? '支出' : '转账'
        const row = [t.date, typeLabel, t.category, t.amount, (t.note || '').replace(/,/g, ' ')]
        lines.push(row.map((c) => `"${c}"`).join(','))
      })
      const csv = lines.join('\n')
      const buffer = Buffer.from(csv, 'utf8')
      const cloudPath = `exports/${openid}/${Date.now()}-transactions.csv`
      const up = await cloud.uploadFile({
        cloudPath,
        fileContent: buffer,
      })
      const tmp = await cloud.getTempFileURL({ fileList: [up.fileID] })
      const url = tmp.fileList[0] && tmp.fileList[0].tempFileURL
      return ok({ fileID: up.fileID, tempFileURL: url, count: r.data.length })
    }

    return fail(400, '未知 action')
  } catch (e) {
    console.error(e)
    return fail(500, e.message || '错误')
  }
}
