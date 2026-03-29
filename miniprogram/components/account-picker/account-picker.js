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
      const list = this.properties.accounts || []
      const labels = list.map((a) => ({
        label: `${a.name} (${a.type})`,
        id: a._id,
      }))
      let idx = list.findIndex((a) => a._id === this.properties.value)
      if (idx < 0) idx = 0
      const display =
        list.length && list[idx] ? `${list[idx].name}` : '请选择账户'
      this.setData({ labels, index: idx, display })
    },
    onChange(e) {
      const idx = Number(e.detail.value)
      const list = this.properties.accounts || []
      const acc = list[idx]
      if (!acc) return
      this.setData({ index: idx, display: acc.name })
      this.triggerEvent('change', { accountId: acc._id, account: acc })
    },
  },
})
