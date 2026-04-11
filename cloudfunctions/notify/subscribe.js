/**
 * notify 云函数本地订阅消息模板 ID 配置
 *
 * 部署云函数时不要跨目录依赖小程序端配置。
 * 在微信公众平台「订阅消息」中创建模板后，将模板 ID 填入下方对应位置。
 * 留空则安全降级：记录日志并跳过发送。
 */

const SERVER_TEMPLATE_IDS = {
  budget: '',       // 预算提醒模板 ID
  installment: '',  // 分期还款提醒模板 ID
  recurring: '',    // 周期收入提醒模板 ID
}

module.exports = {
  SERVER_TEMPLATE_IDS,
}
