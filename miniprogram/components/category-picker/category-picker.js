Component({
  properties: {
    categories: { type: Array, value: [] },
    value: { type: String, value: '' },
  },
  data: {
    index: 0,
    display: '请选择分类',
  },
  observers: {
    categories() {
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
      const cats = this.properties.categories || []
      let idx = cats.indexOf(this.properties.value)
      if (idx < 0) idx = 0
      const display = cats.length ? cats[idx] : '请选择分类'
      this.setData({ index: idx, display })
    },
    onChange(e) {
      const idx = Number(e.detail.value)
      const cats = this.properties.categories || []
      const name = cats[idx]
      this.setData({ index: idx, display: name })
      this.triggerEvent('change', { category: name })
    },
  },
})
