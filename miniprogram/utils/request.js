/**
 * 统一云函数调用
 * @param {string} name 云函数名
 * @param {object} data 参数（可含 action 字段）
 */
function callCloud(name, data = {}) {
  return wx.cloud
    .callFunction({ name, data })
    .then((res) => {
      const r = res.result
      if (!r) {
        return Promise.reject({ code: -1, message: '空响应' })
      }
      if (r.code !== 0 && r.code !== 200) {
        return Promise.reject(r)
      }
      return r.data
    })
    .catch((err) => {
      if (err && err.message) {
        return Promise.reject(err)
      }
      return Promise.reject({ code: -1, message: '网络异常' })
    })
}

module.exports = {
  callCloud,
}
