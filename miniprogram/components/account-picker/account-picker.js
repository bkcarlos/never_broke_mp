Component({
  properties: {
    accounts: { type: Array, value: [] },
    value: { type: String, value: '' },
  },
  data: {
    index: 0,
    labels: [],
    display: '请选择账户',
  },
  observers: {
    accounts() {
      this.sync()
    },
    value() {
      this.sync()
    },
  },
  lifetimes: {
    attached() {
      this.sync()
    },
  },
  methods: {
    sync() {
      const app = getApp()
      const t =
        app && app.globalData && app.globalData.i18n
          ? app.globalData.i18n.t.bind(app.globalData.i18n)
          : null
      const unnamed = t ? t('ledger.unnamedAccount') : '账户'
      const pickPh = t ? t('accounts.pickAccount') : '请选择账户'
      const list = this.properties.accounts || []
      const labels = list.map((a) => ({
        label: a.name || unnamed,
        id: a._id,
      }))
      let idx = list.findIndex((a) => a._id === this.properties.value)
      if (idx < 0) idx = 0
      const cur = list.length && list[idx] ? list[idx] : null
      const display = cur ? cur.name || unnamed : pickPh
      this.setData({ labels, index: idx, display })
    },
    onChange(e) {
      const idx = Number(e.detail.value)
      const list = this.properties.accounts || []
      const acc = list[idx]
      if (!acc) return
      const app = getApp()
      const t =
        app && app.globalData && app.globalData.i18n
          ? app.globalData.i18n.t.bind(app.globalData.i18n)
          : null
      const unnamed = t ? t('ledger.unnamedAccount') : '账户'
      this.setData({ index: idx, display: acc.name || unnamed })
      this.triggerEvent('change', { accountId: acc._id, account: acc })
    },
  },
})
