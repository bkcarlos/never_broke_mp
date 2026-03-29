function isPositiveNumber(v) {
  const n = Number(v)
  return !Number.isNaN(n) && n > 0
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

module.exports = {
  isPositiveNumber,
  isNonEmptyString,
}
