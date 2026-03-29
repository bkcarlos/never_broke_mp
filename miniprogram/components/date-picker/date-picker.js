const { formatDate } = require('../../utils/format.js')

Component({
  properties: {
    value: { type: String, value: '' },
  },
  lifetimes: {
    attached() {
      if (!this.properties.value) {
        const v = formatDate(new Date())
        this.setData({ value: v })
        this.triggerEvent('change', { date: v })
      }
    },
  },
  methods: {
    onChange(e) {
      const date = e.detail.value
      this.setData({ value: date })
      this.triggerEvent('change', { date })
    },
  },
})
