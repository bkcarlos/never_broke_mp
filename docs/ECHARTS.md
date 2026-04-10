# 可选：接入 ECharts（echarts-for-weixin）

当前报表与现金流使用 **Canvas 2D 自绘**（`miniprogram/utils/chart-draw.js`），以控制包体积。

若需要完整 ECharts 能力（交互、图例、缩放等）：

1. 从 [echarts-for-weixin](https://github.com/ecomfe/echarts-for-weixin) 拷贝 `ec-canvas` 组件到 `miniprogram/components/ec-canvas/`。
2. 在微信开发者工具中启用「使用 npm」，安装 `echarts` 并构建 npm。
3. 在 `pages/reports/index`、`pages/reports/cashflow` 等页引入 `ec-canvas`，用 `echarts.init` 绑定 `canvas` 节点。

自绘图表可保留为降级方案或逐步替换。