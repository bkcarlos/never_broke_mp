/**
 * 在微信公众平台订阅消息中创建模板后，将模板 ID 填入下方数组。
 * 留空则「请求订阅消息」按钮会提示先配置。
 */
const TEMPLATE_IDS = [
  '', // 预算提醒
  '', // 分期还款
  '', // 周期收入
]

module.exports = {
  TEMPLATE_IDS,
}
