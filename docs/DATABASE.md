# 云数据库集合说明

在云开发控制台创建以下集合（名称建议一致）：


| 集合                | 说明               |
| ----------------- | ---------------- |
| users             | 用户（openid、昵称、头像） |
| accounts          | 账户               |
| transactions      | 交易               |
| budgets           | 月度预算             |
| installment_plans | 分期计划             |
| recurring_incomes | 周期收入             |
| user_settings     | 用户设置             |
| salary_plans      | 工资方案             |
| notification_log  | 订阅消息发送日志与去重记录    |


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

## 字段结构建议

### `users`

- `openid`: 用户唯一标识
- `nickName`: 用户昵称
- `avatarUrl`: 头像地址
- `createdAt` / `updatedAt`: 创建与更新时间

### `accounts`

- `openid`: 数据归属用户
- `name`: 账户名称
- `type`: 账户类型（现金 / 储蓄 / 信用卡等）
- `balance`: 当前余额
- `currency`: 币种
- `archived`: 是否归档
- `creditLimit`: 信用卡额度（如适用）
- `createdAt` / `updatedAt`: 创建与更新时间

### `transactions`

- `openid`: 数据归属用户
- `type`: 交易类型（income / expense / transfer）
- `accountId`: 主账户 ID
- `toAccountId`: 转入账户 ID（转账时）
- `category`: 分类键值
- `amount`: 金额
- `date`: 交易日期（YYYY-MM-DD）
- `note`: 备注
- `currency`: 币种
- `createdAt` / `updatedAt`: 创建与更新时间

### `budgets`

- `openid`: 数据归属用户
- `year`: 预算年份
- `month`: 预算月份
- `totalBudget`: 月预算总额
- `alert80`: 是否开启 80% 提醒
- `alertOver`: 是否开启超支提醒
- `createdAt` / `updatedAt`: 创建与更新时间

### `installment_plans`

- `openid`: 数据归属用户
- `title`: 分期标题
- `totalAmount`: 总金额
- `installments`: 总期数
- `schedule`: 每期计划数组（期数、日期、金额、是否已还）
- `status`: 状态（active / finished）
- `accountId`: 关联账户
- `currency`: 币种
- `createdAt` / `updatedAt`: 创建与更新时间

### `recurring_incomes`

- `openid`: 数据归属用户
- `name`: 周期收入名称
- `amount`: 金额
- `frequency`: 周期（weekly / monthly / yearly）
- `nextDueDate`: 下一次到期日
- `accountId`: 入账账户
- `currency`: 币种
- `createdAt` / `updatedAt`: 创建与更新时间

### `user_settings`

- `openid`: 数据归属用户
- `language`: 语言设置
- `hideAmount`: 是否隐藏金额
- `safetyLine`: 现金流安全线
- `notifyBudget`: 是否开启预算提醒
- `notifyInstallment`: 是否开启分期提醒
- `notifyRecurring`: 是否开启周期收入提醒
- `createdAt` / `updatedAt`: 创建与更新时间

### `salary_plans`

- `openid`: 数据归属用户
- `name`: 薪资方案名称
- `baseSalary`: 基本工资
- `bonus`: 奖金等补充收入
- `socialInsurance`: 社保参数
- `housingFund`: 公积金参数
- `tax`: 试算个税结果
- `createdAt` / `updatedAt`: 创建与更新时间

### `notification_log`

- `openid`: 接收用户
- `type`: 通知类型（budget / installment / recurring）
- `date`: 发送日期（YYYY-MM-DD）
- `success`: 是否发送成功或被安全跳过
- `detail`: 附加明细（预算比例、期数、金额等）
- `createdAt`: 记录创建时间

## 云函数与集合对应关系

- `login` → `users`
- `account` → `accounts`
- `transaction` → `transactions`、`accounts`
- `budget` → `budgets`、`transactions`
- `installment` → `installment_plans`
- `recurring` → `recurring_incomes`
- `payroll` → `salary_plans`
- `cashflow` → `accounts`、`transactions`、`recurring_incomes`、`installment_plans`
- `report` → `transactions`、`accounts`、`budgets`、`user_settings`
- `dataManage` → `transactions`、`accounts`
- `settings` → `user_settings`
- `notify` → `notification_log`、`user_settings`、`budgets`、`transactions`、`installment_plans`、`recurring_incomes`