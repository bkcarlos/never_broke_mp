# 生产部署 Checklist（NeverBroke）

> 用于补齐正式环境上线前的云开发、小程序后台与订阅消息配置。本清单只描述检查与配置步骤，不包含实际控制台操作结果。

## 当前检查结论

### 1. 云环境 ID
- 文件：`miniprogram/config/env.js`
- 当前值：`neverbroke-5g1p5xyr29273bab`
- 结论：**不是占位符**
- 判断依据：占位符常量为 `your-cloud-env-id`，当前 `CLOUD_ENV_ID` 已替换为具体环境 ID。

### 2. 订阅消息模板 ID
- 文件：`miniprogram/config/subscribe.js`
- 当前状态：`TEMPLATE_IDS` 数组中的 3 个模板 ID 全部为空字符串
- 结论：**尚未配置**
- 涉及模板：
  - 预算提醒
  - 分期还款
  - 周期收入

### 3. 数据库文档
- 文件：`docs/DATABASE.md`
- 当前状态：**已补充至可用于生产部署核对**
- 已包含：
  - 需要创建的集合列表
  - 各集合用途说明
  - 生产权限建议
  - 已落地查询对应的索引建议
- 仍建议后续补充：
  - 每个集合字段结构说明
  - 必建/推荐索引的区分
  - 唯一索引要求说明
  - 初始化数据/校验步骤
  - 云函数依赖哪些集合的映射说明

## 需要创建的数据库集合

根据 `docs/DATABASE.md`，生产环境至少需要创建以下集合：

1. `users`
2. `accounts`
3. `transactions`
4. `budgets`
5. `installment_plans`
6. `recurring_incomes`
7. `user_settings`
8. `salary_plans`
9. `notification_log`

## 建议创建的索引

当前文档中已明确的索引：

- `transactions`：`openid + date`
- `budgets`：`openid + year + month`
- `accounts`：`openid`
- `installment_plans`：`openid + status`
- `recurring_incomes`：`openid + nextDueDate`
- `salary_plans`：`openid`
- `user_settings`：`openid`
- `notification_log`：`openid + type + date`

---

## 部署操作 Checklist

### A. 微信云开发控制台

#### A1. 确认正式云环境
- [ ] 登录微信开发者工具或微信云开发控制台
- [ ] 打开目标项目对应的云开发环境
- [ ] 核对环境 ID 是否为：`neverbroke-5g1p5xyr29273bab`
- [ ] 确认该环境为正式使用环境，而不是测试/个人环境
- [ ] 若需更换环境，更新 `miniprogram/config/env.js`

#### A2. 创建数据库集合
- [ ] 创建 `users`
- [ ] 创建 `accounts`
- [ ] 创建 `transactions`
- [ ] 创建 `budgets`
- [ ] 创建 `installment_plans`
- [ ] 创建 `recurring_incomes`
- [ ] 创建 `user_settings`
- [ ] 创建 `salary_plans`
- [ ] 创建 `notification_log`（订阅消息发送日志与去重依赖）

#### A3. 创建数据库索引
- [ ] 为 `transactions` 创建组合索引：`openid + date`
- [ ] 为 `budgets` 创建组合索引：`openid + year + month`
- [ ] 为 `accounts` 创建索引：`openid`
- [ ] 为 `installment_plans` 创建组合索引：`openid + status`
- [ ] 为 `recurring_incomes` 创建组合索引：`openid + nextDueDate`
- [ ] 为 `salary_plans` 创建索引：`openid`
- [ ] 为 `user_settings` 创建索引：`openid`
- [ ] 为 `notification_log` 创建组合索引：`openid + type + date`

#### A4. 检查数据库权限
- [ ] 确认生产环境是否关闭客户端直连敏感读写
- [ ] 如保留客户端访问，至少设置为“仅创建者可读写”或等效安全规则
- [ ] 验证云函数按 `openid` 做数据隔离
- [ ] 抽查敏感集合是否存在越权读取风险

#### A5. 部署云函数
- [ ] 部署全部生产所需云函数
- [ ] 检查云函数环境绑定是否指向正式环境
- [ ] 检查云函数所需权限/依赖是否完整
- [ ] 手动验证核心流程：登录、记账、预算、报表读取

### B. 微信公众平台 / 小程序后台

#### B1. 配置订阅消息模板
- [ ] 进入微信公众平台
- [ ] 打开“小程序 > 订阅消息”
- [ ] 创建并审核通过以下模板：
  - [ ] 预算提醒
  - [ ] 分期还款提醒
  - [ ] 周期收入提醒
- [ ] 获取每个模板的模板 ID
- [ ] 将模板 ID 填入 `miniprogram/config/subscribe.js`

建议填充形式示例：

```js
const TEMPLATE_IDS = [
  '预算提醒模板ID',
  '分期还款模板ID',
  '周期收入模板ID',
]
```

#### B2. 核对订阅消息可用性
- [ ] 确认模板所属类目与小程序实际类目一致
- [ ] 确认模板文案与触发场景匹配
- [ ] 确认用户授权链路在前端已可触发
- [ ] 若需要服务端主动发送，补充云函数 + 定时触发器

#### B3. 上线审核信息
- [ ] 配置《用户协议》链接
- [ ] 配置《隐私政策》链接
- [ ] 确认登录页文案、隐私弹窗与提交审核版本一致
- [ ] 确认类目与产品功能一致
- [ ] 保留“仅供参考”类免责声明（薪资测算、现金流预测等）

### C. 如需启用服务端提醒

当前仓库已新增 `cloudfunctions/notify` 云函数与部署参考配置，可用于预算、分期、周期收入提醒。

需要补充：
- [ ] 在 `miniprogram/config/subscribe.js` 中填写前端与服务端模板 ID
- [ ] 部署 `cloudfunctions/notify` 云函数
- [ ] 创建 `notification_log` 集合与索引
- [ ] 配置定时触发器，按预算/分期/周期收入规则调度
- [ ] 确保只向已授权模板的用户发送
- [ ] 核对失败日志与发送记录

---

## 如何获取/配置各项

### 1. 如何获取云环境 ID
1. 打开微信开发者工具。
2. 进入“云开发”面板。
3. 查看当前环境列表中的环境 ID。
4. 复制正式环境 ID。
5. 写入 `miniprogram/config/env.js` 的 `CLOUD_ENV_ID`。

### 2. 如何获取订阅消息模板 ID
1. 登录微信公众平台。
2. 进入小程序后台的“订阅消息”。
3. 新建对应行业/类目允许的模板。
4. 提交审核并等待通过。
5. 在模板列表中复制模板 ID。
6. 将 ID 填入 `miniprogram/config/subscribe.js`。

### 3. 如何创建数据库集合和索引
1. 打开云开发控制台。
2. 进入数据库。
3. 逐个创建业务集合。
4. 打开每个集合的索引配置。
5. 按文档创建组合索引和普通索引。
6. 使用开发者工具/真机验证相关查询是否命中索引、是否能正常读写。

---

## 建议的后续补文档项

建议后续把 `docs/DATABASE.md` 补充为完整生产文档，至少增加：
- 每个集合字段清单
- 字段类型和必填规则
- 推荐索引与唯一约束
- 数据权限策略
- 初始化/验收步骤
- 与云函数或页面功能的对应关系
