/**
 * 在微信公众平台订阅消息中创建模板后，将模板 ID 填入下方数组。
 * 留空则「请求订阅消息」按钮会提示先配置。
 *
 * 服务端推送（可选）：需自建云函数定时任务，在用户授权前提下调用
 * cloud.openapi.subscribeMessage.send（需小程序类目与模板审核通过）。
 */
const TEMPLATE_IDS = [
  '', // 预算提醒
  '', // 分期还款
  '', // 周期收入
]

module.exports = {
  TEMPLATE_IDS,
}
