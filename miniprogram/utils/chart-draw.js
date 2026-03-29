/** Canvas 2D 简易图表（不依赖 ECharts，减轻包体积） */

const PIE_COLORS = ['#1aad19', '#52c41a', '#faad14', '#ff6b6b', '#1890ff', '#722ed1', '#13c2c2', '#eb2f96', '#999999']

function drawPieCanvas(canvas, width, height, slices) {
  const ctx = canvas.getContext('2d')
  const dpr = wx.getSystemInfoSync().pixelRatio || 1
  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (!total) {
    ctx.fillStyle = '#999'
    ctx.font = '14px sans-serif'
    ctx.fillText('暂无数据', width / 2 - 32, height / 2)
    return
  }
  const cx = width * 0.36
  const cy = height / 2
  const r = Math.min(width, height) * 0.32
  let angle = -Math.PI / 2
  slices.forEach((sl, i) => {
    const a = (sl.value / total) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, angle, angle + a)
    ctx.closePath()
    ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length]
    ctx.fill()
    angle += a
  })
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
}

function drawLineCanvas(canvas, width, height, points) {
  const ctx = canvas.getContext('2d')
  const dpr = wx.getSystemInfoSync().pixelRatio || 1
  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, width, height)
  if (!points.length) return
  const maxV = Math.max(...points.map((p) => p.value), 1)
  const minV = Math.min(...points.map((p) => p.value), 0)
  const span = maxV - minV || 1
  const padL = 40
  const padR = 12
  const padT = 16
  const padB = 28
  const gw = width - padL - padR
  const gh = height - padT - padB
  ctx.strokeStyle = '#e5e5e5'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padL, padT)
  ctx.lineTo(padL, padT + gh)
  ctx.lineTo(padL + gw, padT + gh)
  ctx.stroke()
  ctx.strokeStyle = '#1aad19'
  ctx.lineWidth = 2
  ctx.beginPath()
  points.forEach((p, i) => {
    const x = padL + (gw * i) / Math.max(1, points.length - 1)
    const y = padT + gh - ((p.value - minV) / span) * gh
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
  ctx.fillStyle = '#1aad19'
  points.forEach((p, i) => {
    const x = padL + (gw * i) / Math.max(1, points.length - 1)
    const y = padT + gh - ((p.value - minV) / span) * gh
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.fillStyle = '#999'
  ctx.font = '10px sans-serif'
  points.forEach((p, i) => {
    const x = padL + (gw * i) / Math.max(1, points.length - 1)
    const lab = (p.label && p.label.slice(5)) || ''
    ctx.fillText(lab, x - 12, padT + gh + 14)
  })
}

module.exports = {
  drawPieCanvas,
  drawLineCanvas,
}
