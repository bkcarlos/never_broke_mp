const auth = require('../../utils/auth.js')

Page({
  onShow() {
    auth.requireLogin()
  },
})
