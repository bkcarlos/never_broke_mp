const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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
      const acc = await accCol.doc(defaultAccountId).get()
      if (!acc.data || acc.data.openid !== openid) return fail(403, '默认账户无效')

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

      let inserted = 0
      for (const row of list) {
        const date = row.date || row.日期
        const typeRaw = String(row.type || row.类型 || 'expense').toLowerCase()
        const type =
          typeRaw === '收入' || typeRaw === 'income' ? 'income' : 'expense'
        const amount = Number(row.amount || row.金额 || 0)
        const category = row.category || row.分类 || '其他'
        const note = row.note || row.备注 || ''
        if (!date || !amount) continue
        await txCol.add({
          data: {
            openid,
            type,
            amount,
            category,
            date,
            note,
            accountId: defaultAccountId,
            toAccountId: '',
            installmentPlanId: '',
            createdAt: now,
            updatedAt: now,
          },
        })
        inserted += 1
      }
      return ok({ inserted })
    }

    if (action === 'exportGenerate') {
      const { startDate, endDate } = event
      if (!startDate || !endDate) return fail(400, '缺少日期范围')
      const _ = db.command
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
