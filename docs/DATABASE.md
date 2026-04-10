# 云数据库集合说明

在云开发控制台创建以下集合（名称建议一致）：

| 集合 | 说明 |
|------|------|
| users | 用户（openid、昵称、头像） |
| accounts | 账户 |
| transactions | 交易 |
| budgets | 月度预算 |
| installment_plans | 分期计划 |
| recurring_incomes | 周期收入 |
| user_settings | 用户设置 |
| salary_plans | 工资方案 |
| notification_log | 订阅消息发送日志与去重记录 |

## 权限建议

- 生产环境建议**关闭**客户端直连数据库读写，仅通过云函数访问；或将权限设为「仅创建者可读写」并确保敏感写操作只在云函数中执行。
- 本项目的云函数均使用 `openid` 字段过滤数据，部署后请在控制台验证规则。

## 索引建议

- `transactions`: `openid` + `date`
- `budgets`: `openid` + `year` + `month`
- `accounts`: `openid`
- `installment_plans`: `openid` + `status`
- `recurring_incomes`: `openid` + `nextDueDate`
- `salary_plans`: `openid`
- `user_settings`: `openid`
- `notification_log`: `openid` + `type` + `date`
