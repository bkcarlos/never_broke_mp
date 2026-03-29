const auth = require('./auth.js')

function handleAuthFailure() {
  try {
    auth.clearAuth()
  } catch (e) {
    /* ignore */
  }
  wx.reLaunch({ url: '/pages/login/index' })
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 统一云函数调用（网络类错误自动重试 2 次）
 * @param {string} name 云函数名
 * @param {object} data 参数（可含 action 字段）
 * @param {{ retries?: number }} [opts]
 */
function callCloud(name, data = {}, opts = {}) {
  const maxRetry = opts.retries != null ? opts.retries : 2

  const once = () =>
    wx.cloud
      .callFunction({ name, data })
      .then((res) => {
        const r = res.result
        if (!r) {
          return Promise.reject({ code: -1, message: '空响应' })
        }
        if (r.code === 401) {
          handleAuthFailure()
          return Promise.reject(r)
        }
        if (r.code !== 0 && r.code !== 200) {
          return Promise.reject(r)
        }
        return r.data
      })
      .catch((err) => {
        if (err && err.code === 401) {
          handleAuthFailure()
          return Promise.reject(err)
        }
        if (err && typeof err.code === 'number' && typeof err.message === 'string') {
          return Promise.reject(err)
        }
        const msg =
          (err && typeof err.errMsg === 'string' && err.errMsg) ||
          (err && typeof err.message === 'string' && err.message) ||
          '网络异常，请检查云环境 ID、云函数是否已部署'
        return Promise.reject({ code: -1, message: msg })
      })

  const run = (left) =>
    once().catch((err) => {
      if (left > 0 && err && err.code === -1) {
        return delay(400).then(() => run(left - 1))
      }
      return Promise.reject(err)
    })

  return run(maxRetry)
}

module.exports = {
  callCloud,
}
