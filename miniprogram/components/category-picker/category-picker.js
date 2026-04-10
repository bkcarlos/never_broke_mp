const helper = require('../../utils/category-label-helper.js')

Component({
  properties: {
    categories: { type: Array, value: [] },
    value: { type: String, value: '' },
  },
  data: {
    index: 0,
    display: '',
    placeholder: '',
    range: [],
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
      this.loadI18n()
      this.sync()
    },
  },
  methods: {
    loadI18n() {
      const app = getApp()
      if (!app || !app.globalData || !app.globalData.i18n) return
      const t = app.globalData.i18n.t.bind(app.globalData.i18n)
      this.setData({ placeholder: t('common.chooseCategory') })
    },
    normalizeCategories() {
      return (this.properties.categories || []).map((item) => {
        if (item && typeof item === 'object') {
          const value = item.value || ''
          return {
            value,
            label: item.label || helper.getCategoryLabel(value),
          }
        }
        return {
          value: item,
          label: helper.getCategoryLabel(item),
        }
      })
    },
    sync() {
      const cats = this.normalizeCategories()
      const values = cats.map((item) => item.value)
      let idx = values.indexOf(this.properties.value)
      if (idx < 0) idx = 0
      const placeholder = this.data.placeholder || '请选择分类'
      const display = cats.length ? cats[idx].label : placeholder
      const range = cats.map((item) => item.label)
      this.setData({ index: idx, display, range })
    },
    onChange(e) {
      const idx = Number(e.detail.value)
      const cats = this.normalizeCategories()
      const item = cats[idx]
      this.setData({ index: idx, display: item ? item.label : this.data.placeholder, range: cats.map((x) => x.label) })
      this.triggerEvent('change', { category: item ? item.value : '' })
    },
  },
})
