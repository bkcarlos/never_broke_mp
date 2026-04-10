const C = require('./constants.js')

function getI18n() {
  const app = typeof getApp === 'function' ? getApp() : null
  return app && app.globalData ? app.globalData.i18n : null
}

function normalizeCategoryKey(category) {
  const raw = String(category || '').trim()
  if (!raw) return ''
  return C.LEGACY_CATEGORY_KEY_MAP[raw] || raw
}

function getCategoryLabel(category, fallbackLabel) {
  const raw = String(category || '').trim()
  if (!raw) return fallbackLabel || ''

  const key = normalizeCategoryKey(raw)
  const i18n = getI18n()
  if (i18n && typeof i18n.t === 'function') {
    const translated = i18n.t(`categories.${key}`)
    if (translated && translated !== `categories.${key}`) return translated
  }

  return C.CATEGORY_FALLBACK_LABELS[key] || raw || fallbackLabel || ''
}

function buildCategoryOptions(categories) {
  return (categories || []).map((value) => ({
    value,
    label: getCategoryLabel(value),
  }))
}

function buildCategoryFilterOptions(categories, allLabel) {
  const seen = {}
  const out = [{ value: '', label: allLabel }]
  ;(categories || []).forEach((item) => {
    const key = normalizeCategoryKey(item)
    if (!key || seen[key]) return
    seen[key] = true
    out.push({ value: key, label: getCategoryLabel(item) })
  })
  return out
}

module.exports = {
  normalizeCategoryKey,
  getCategoryLabel,
  buildCategoryOptions,
  buildCategoryFilterOptions,
}
