#!/usr/bin/env node
/**
 * 校验 app.json 中的页面路径在磁盘上存在
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'))
let failed = 0
for (const p of appJson.pages) {
  const base = path.join(root, 'miniprogram', p)
  const exists = ['.wxml', '.js', '.json'].every((ext) => fs.existsSync(base + ext))
  if (!exists) {
    console.error('Missing page files:', p)
    failed++
  }
}
if (failed) process.exit(1)
console.log('All', appJson.pages.length, 'pages OK.')
