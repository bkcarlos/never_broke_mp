const cloud = require('wx-server-sdk')

const { SERVER_TEMPLATE_IDS } = require('../../miniprogram/config/subscribe.js')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function ok(data) {
  return { code: 0, message: 'ok', data }
}
function fail(code, message) {
  return { code, message, data: null }
}

/**
 * 模板 ID 配置（需在微信公众平台订阅消息中创建模板后填入）
 * 留空时将安全降级，不发送推送但记录日志
 */
const TEMPLATE_IDS = SERVER_TEMPLATE_IDS

/**
 * 发送订阅消息
 * @param {string} openid 用户 openid
 * @param {string} templateId 模板 ID
 * @param {object} data 模板数据
 * @param {string} page 跳转页面
 */
async function sendSubscribeMessage(openid, templateId, data, page = 'pages/index/index') {
  if (!templateId) {
    console.log('[notify] 模板 ID 未配置，跳过发送', { openid, page })
    return { skipped: true, reason: 'TEMPLATE_ID_EMPTY' }
  }
  try {
    const result = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      page,
      data,
      templateId,
    })
    console.log('[notify] 发送成功', { openid, page, result })
    return { success: true, result }
  } catch (err) {
    console.error('[notify] 发送失败', { openid, page, err: err.errMsg || err.message })
    // 常见错误码：43101（用户拒绝/未授权）、43703（模板不存在）、47003（参数错误）
    return { success: false, error: err.errMsg || err.message, errCode: err.errCode }
  }
}

/**
 * 格式化金额
 */
function formatMoney(amount) {
  return String(Number(amount || 0).toFixed(2))
}

/**
 * 获取今日日期字符串 YYYY-MM-DD
 */
function todayDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 获取当前年月 YYYY-MM
 */
function currentYearMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 检查用户今日是否已发送过某类通知
 * @param {string} openid 用户 openid
 * @param {string} type 通知类型 budget/installment/recurring
 * @param {string} date 日期 YYYY-MM-DD
 */
async function checkAlreadySent(openid, type, date) {
  try {
    const col = db.collection('notification_log')
    const r = await col
      .where({
        openid,
        type,
        date,
      })
      .limit(1)
      .get()
    return r.data.length > 0
  } catch (e) {
    console.error('[notify] 检查发送记录失败', e)
    return false
  }
}

/**
 * 记录发送日志
 */
async function logNotification(openid, type, date, success, detail = {}) {
  try {
    const col = db.collection('notification_log')
    await col.add({
      data: {
        openid,
        type,
        date,
        success,
        detail,
        createdAt: db.serverDate(),
      },
    })
  } catch (e) {
    console.error('[notify] 记录发送日志失败', e)
  }
}

/**
 * 发送预算提醒
 * 触发条件：预算使用率 >= 80% 或超支，且用户开启了 notifyBudget
 */
async function sendBudgetAlerts() {
  console.log('[notify] 开始发送预算提醒')
  const today = todayDate()
  const ym = currentYearMonth()
  const { year, month } = ymParts(ym)
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // 1. 获取所有开启了预算提醒的用户设置
  const settingsCol = db.collection('user_settings')
  const settingsRes = await settingsCol.where({ notifyBudget: true }).get()
  const openids = settingsRes.data.map((s) => s.openid)

  if (openids.length === 0) {
    console.log('[notify] 没有开启预算提醒的用户')
    return ok({ sent: 0, skipped: 0 })
  }

  // 2. 获取所有用户的预算和支出情况
  const budgetCol = db.collection('budgets')
  const txCol = db.collection('transactions')
  const budgetsRes = await budgetCol.where({ year, month }).get()
  const budgets = budgetsRes.data.filter((b) => openids.includes(b.openid))

  let sent = 0
  let skipped = 0

  for (const budget of budgets) {
    const { openid } = budget
    const total = Number(budget.totalBudget || 0)
    if (total <= 0) continue

    // 检查今日是否已发送
    const alreadySent = await checkAlreadySent(openid, 'budget', today)
    if (alreadySent) {
      skipped++
      continue
    }

    // 计算已使用金额
    const txRes = await txCol
      .where({
        openid,
        type: 'expense',
        date: _.gte(start).and(_.lte(end)),
      })
      .get()
    const used = txRes.data.reduce((sum, t) => sum + Number(t.amount || 0), 0)
    const pct = Math.min(100, Math.round((used / total) * 100))

    // 判断是否需要提醒
    const shouldAlert = pct >= 100 ? budget.alertOver !== false : pct >= 80 ? budget.alert80 !== false : false
    if (!shouldAlert) continue

    // 发送消息
    const templateId = TEMPLATE_IDS.budget
    const data = {
      thing1: { value: `${year}年${month}月预算` }, // 预算标题
      amount2: { value: formatMoney(used) },         // 已使用金额
      amount3: { value: formatMoney(total) },        // 总预算
      thing4: { value: pct >= 100 ? '已超支' : `已使用${pct}%` }, // 使用情况
    }
    const result = await sendSubscribeMessage(openid, templateId, data, 'pages/profile/budget')
    await logNotification(openid, 'budget', today, result.success || result.skipped, {
      pct,
      used,
      total,
    })
    if (result.success) sent++
    else skipped++
  }

  console.log(`[notify] 预算提醒完成: 发送 ${sent} 条，跳过 ${skipped} 条`)
  return ok({ sent, skipped })
}

/**
 * 发送分期还款提醒
 * 触发条件：未来 7 天内有待还款期数，且用户开启了 notifyInstallment
 */
async function sendInstallmentAlerts() {
  console.log('[notify] 开始发送分期还款提醒')
  const today = todayDate()
  const todayObj = new Date(today)

  // 计算提醒截止日期（7 天后）
  const alertEndObj = new Date(todayObj)
  alertEndObj.setDate(alertEndObj.getDate() + 7)
  const alertEnd = alertEndObj.toISOString().slice(0, 10)

  // 1. 获取所有开启了分期提醒的用户设置
  const settingsCol = db.collection('user_settings')
  const settingsRes = await settingsCol.where({ notifyInstallment: true }).get()
  const openids = settingsRes.data.map((s) => s.openid)

  if (openids.length === 0) {
    console.log('[notify] 没有开启分期提醒的用户')
    return ok({ sent: 0, skipped: 0 })
  }

  // 2. 获取所有活跃的分期计划
  const col = db.collection('installment_plans')
  const plansRes = await col.where({ status: 'active' }).get()
  const plans = plansRes.data.filter((p) => openids.includes(p.openid))

  let sent = 0
  let skipped = 0

  for (const plan of plans) {
    const { openid, schedule, title, totalAmount, installments } = plan
    if (!schedule || schedule.length === 0) continue

    // 找到未来 7 天内未还款的期数
    const dueItems = schedule.filter((s) => !s.paid && s.date >= today && s.date <= alertEnd)
    if (dueItems.length === 0) continue

    // 检查今日是否已发送
    const alreadySent = await checkAlreadySent(openid, 'installment', today)
    if (alreadySent) {
      skipped++
      continue
    }

    // 获取最近一期
    const nextDue = dueItems[0]

    // 发送消息
    const templateId = TEMPLATE_IDS.installment
    const data = {
      thing1: { value: title || `分期计划（${installments}期）` }, // 计划名称
      thing2: { value: `第${nextDue.index}期` },                    // 当前期数
      amount3: { value: formatMoney(nextDue.amount) },              // 当期金额
      date4: { value: nextDue.date },                               // 还款日期
    }
    const result = await sendSubscribeMessage(openid, templateId, data, 'pages/profile/installment')
    await logNotification(openid, 'installment', today, result.success || result.skipped, {
      planId: plan._id,
      dueIndex: nextDue.index,
      dueDate: nextDue.date,
      dueAmount: nextDue.amount,
    })
    if (result.success) sent++
    else skipped++
  }

  console.log(`[notify] 分期还款提醒完成: 发送 ${sent} 条，跳过 ${skipped} 条`)
  return ok({ sent, skipped })
}

/**
 * 发送周期收入到期提醒
 * 触发条件：今天或未来 3 天内有到期的周期收入，且用户开启了 notifyRecurring
 */
async function sendRecurringAlerts() {
  console.log('[notify] 开始发送周期收入到期提醒')
  const today = todayDate()
  const todayObj = new Date(today)

  // 计算提醒截止日期（3 天后）
  const alertEndObj = new Date(todayObj)
  alertEndObj.setDate(alertEndObj.getDate() + 3)
  const alertEnd = alertEndObj.toISOString().slice(0, 10)

  // 1. 获取所有开启了周期收入提醒的用户设置
  const settingsCol = db.collection('user_settings')
  const settingsRes = await settingsCol.where({ notifyRecurring: true }).get()
  const openids = settingsRes.data.map((s) => s.openid)

  if (openids.length === 0) {
    console.log('[notify] 没有开启周期收入提醒的用户')
    return ok({ sent: 0, skipped: 0 })
  }

  // 2. 获取所有周期收入计划
  const col = db.collection('recurring_incomes')
  const itemsRes = await col.get()
  const items = itemsRes.data.filter((i) => openids.includes(i.openid))

  let sent = 0
  let skipped = 0

  for (const item of items) {
    const { openid, name, amount, nextDueDate, frequency } = item
    if (!nextDueDate) continue

    // 检查是否在提醒窗口内
    const dueDate = nextDueDate
    if (dueDate < today || dueDate > alertEnd) continue

    // 检查今日是否已发送
    const alreadySent = await checkAlreadySent(openid, 'recurring', today)
    if (alreadySent) {
      skipped++
      continue
    }

    // 频率显示文本
    const freqText = { weekly: '每周', monthly: '每月', yearly: '每年' }[frequency] || '周期'

    // 发送消息
    const templateId = TEMPLATE_IDS.recurring
    const data = {
      thing1: { value: name || '周期收入' },           // 收入名称
      amount2: { value: formatMoney(amount) },         // 收入金额
      date3: { value: dueDate },                       // 到期日期
      thing4: { value: freqText },                     // 频率
    }
    const result = await sendSubscribeMessage(openid, templateId, data, 'pages/profile/recurring-income')
    await logNotification(openid, 'recurring', today, result.success || result.skipped, {
      itemId: item._id,
      dueDate,
      amount,
    })
    if (result.success) sent++
    else skipped++
  }

  console.log(`[notify] 周期收入提醒完成: 发送 ${sent} 条，跳过 ${skipped} 条`)
  return ok({ sent, skipped })
}

/**
 * 年月拆分
 */
function ymParts(ym) {
  const [y, m] = ym.split('-').map(Number)
  return { year: y, month: m }
}

/**
 * 云函数入口
 * 支持 action: sendBudgetAlerts | sendInstallmentAlerts | sendRecurringAlerts | sendAll
 */
exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  // 定时触发器没有 openid，手动调用时有
  const openid = wxContext.OPENID

  // 仅允许云开发定时触发器或服务端调用（不校验 openid）
  const action = event.action || 'sendAll'

  try {
    const results = {}

    if (action === 'sendBudgetAlerts' || action === 'sendAll') {
      const r = await sendBudgetAlerts()
      results.budget = r.data || r
    }

    if (action === 'sendInstallmentAlerts' || action === 'sendAll') {
      const r = await sendInstallmentAlerts()
      results.installment = r.data || r
    }

    if (action === 'sendRecurringAlerts' || action === 'sendAll') {
      const r = await sendRecurringAlerts()
      results.recurring = r.data || r
    }

    return ok({
      action,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[notify] 执行失败', e)
    return fail(500, e.message || '执行失败')
  }
}
