/**
 * 订阅消息模板 ID 配置
 *
 * 在微信公众平台「订阅消息」中创建模板后，将模板 ID 填入下方对应位置。
 * 留空则：
 *   - 前端「请求订阅消息」按钮会提示先配置
 *   - 服务端 notify 云函数会安全降级（打印日志，不发送消息）
 */

// 前端 wx.requestSubscribeMessage 使用的模板 ID 列表（按顺序：预算/分期/周期收入）
const TEMPLATE_IDS = [
  '', // 预算提醒
  '', // 分期还款
  '', // 周期收入
]

// 服务端云函数 notify 使用的模板 ID 映射（与上方对应，可单独配置）
const SERVER_TEMPLATE_IDS = {
  budget: '',       // 预算提醒模板 ID
  installment: '',  // 分期还款提醒模板 ID
  recurring: '',    // 周期收入提醒模板 ID
}

module.exports = {
  TEMPLATE_IDS,
  SERVER_TEMPLATE_IDS,
}
