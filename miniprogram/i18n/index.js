const zhCN = require('./zh-CN.js')
const enUS = require('./en-US.js')

const languages = {
  'zh-CN': zhCN,
  'en-US': enUS
}

let currentLang = 'zh-CN'

module.exports = {
  setLanguage(lang) {
    if (languages[lang]) {
      currentLang = lang
      wx.setStorageSync('language', lang)
    }
  },
  
  getLanguage() {
    return currentLang
  },
  
  t(key, ...args) {
    const keys = key.split('.')
    let value = languages[currentLang]
    for (const k of keys) {
      value = value?.[k]
    }
    let result = value || key
    args.forEach((arg, i) => {
      result = result.replace(`{${i}}`, arg)
    })
    return result
  },
  
  init() {
    const savedLang = wx.getStorageSync('language')
    if (savedLang && languages[savedLang]) {
      currentLang = savedLang
    } else {
      const systemLang = wx.getSystemInfoSync().language
      currentLang = languages[systemLang] ? systemLang : 'zh-CN'
    }
  }
}
