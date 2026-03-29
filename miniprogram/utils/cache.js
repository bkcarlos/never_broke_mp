/**
 * 轻量内存缓存（按页面 onShow 可配合使用，减少短时间重复请求）
 */
const store = new Map()

function keyOf(parts) {
  return parts.join('::')
}

function get(parts, maxAgeMs) {
  const k = keyOf(parts)
  const hit = store.get(k)
  if (!hit) return null
  if (Date.now() - hit.t > maxAgeMs) {
    store.delete(k)
    return null
  }
  return hit.v
}

function set(parts, value) {
  store.set(keyOf(parts), { v: value, t: Date.now() })
}

function clear(prefixParts) {
  const prefix = keyOf(prefixParts)
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}

module.exports = {
  get,
  set,
  clear,
}
