# 上线与审核准备（NeverBroke）

## 必做

1. **小程序信息**：类目选择与实际功能一致（工具 / 生活服务 / 金融信息展示等，以平台规则为准）。
2. **用户协议与隐私**：在公众平台配置《用户协议》《隐私政策》链接；登录页文案与弹窗与实际上线版本一致。
3. **云开发**：生产环境 ID 写入 `miniprogram/config/env.js`；部署全部云函数；按 [DATABASE.md](./DATABASE.md) 建集合与索引。
4. **订阅消息**（若启用）：在公众平台创建模板，将 ID 填入 `miniprogram/config/subscribe.js`；说明用途与触发场景。
5. **内容声明**：薪资测算、现金流预测等页面保留「仅供参考」类免责声明。

## 建议

- 配置云函数**定时触发器**：已新增 `cloudfunctions/notify` 云函数，默认支持 `sendBudgetAlerts` / `sendInstallmentAlerts` / `sendRecurringAlerts` / `sendAll`。可在云开发控制台为该云函数配置定时触发，或使用仓库内 `cloudfunctions/notify/config.json` 作为部署参考。
- 部署 `notify` 前请确认 `miniprogram/config/subscribe.js` 中前端 `TEMPLATE_IDS` 与服务端 `SERVER_TEMPLATE_IDS` 已按模板用途填写，且数据库已创建 `notification_log` 集合与 `openid + type + date` 组合索引。
- 预算/分期/周期提醒由服务端调度后调用 `cloud.openapi.subscribeMessage.send`；若模板 ID 未配置，会安全降级为跳过发送并记录日志，不会中断任务。
- 打开小程序「性能」面板检查首包与 setData 频率；必要时对报表等页做分包。
- 真机网络弱网测试（云函数重试已默认 2 次）。

## 审核材料

- 功能截图：登录、首页、记账、报表、设置
- 测试账号说明（如需要）
- 数据处理说明：用户数据隔离方式（openid）、存储位置（云开发）