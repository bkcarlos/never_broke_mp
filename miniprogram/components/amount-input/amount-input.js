Component({
  properties: {
    value: { type: String, value: '' },
    placeholder: { type: String, value: '0.00' },
    disabled: { type: Boolean, value: false },
  },
  methods: {
    onInput(e) {
      this.triggerEvent('change', { value: e.detail.value })
    },
  },
})
