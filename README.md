# NeverBroke（认知翻身账）

微信小程序原生 + **微信云开发**（云函数 + 云数据库 + 云存储）。

## 快速开始

1. 使用 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) 导入本项目目录（含 `miniprogram/` 与 `cloudfunctions/`）。
2. 在 `miniprogram/config/env.js` 中填写你的 **云环境 ID**（与 `project.config.json` 中的 `appid` 一致的小程序账号下开通云开发）。
3. 在云开发控制台创建集合，见 [docs/DATABASE.md](./docs/DATABASE.md)。
4. 在每个云函数目录执行依赖安装并上传部署：
   ```bash
   cd cloudfunctions/login && npm install && cd ../..
   # 对 account、transaction、budget、installment、recurring、payroll、cashflow、report、dataManage、settings 重复执行
   ```
   或在开发者工具中右键各云函数目录选择「上传并部署：云端安装依赖」。
5. 编译运行小程序；首次使用在登录页点击「微信一键登录」，再到「我的 → 账户管理」创建账户后即可记账。

## 目录结构

- `miniprogram/`：小程序页面、组件、工具
- `cloudfunctions/`：云函数（按模块拆分）
- `docs/`：数据库说明、测试清单、上线与法律占位
- `NeverBroke.md`：产品需求文档

## 校验

```bash
npm run check
```

## 说明

- 图表：报表与现金流使用 **Canvas 2D 自绘**（见 `miniprogram/utils/chart-draw.js`）；可选接入 ECharts 见 [docs/ECHARTS.md](./docs/ECHARTS.md)。
- 测试与上线：[docs/TESTING.md](./docs/TESTING.md)、[docs/LAUNCH.md](./docs/LAUNCH.md)。
- 薪资与个税为**演示算法**，请以实际扣缴为准。
- 导入 CSV 请使用 **UTF-8** 编码。

## 云函数一览

| 名称 | 作用 |
|------|------|
| login | 登录/ upsert 用户 |
| account | 账户 CRUD、信用卡额度 |
| transaction | 记账、转账、按日查询 |
| budget | 月度预算 |
| installment | 分期预览/创建/列表 |
| recurring | 周期收入 |
| payroll | 薪资测算与方案 |
| cashflow | 现金流预测 |
| report | 首页概览、报表、时间线 |
| dataManage | 导入/导出 CSV |
| settings | 用户设置 |
