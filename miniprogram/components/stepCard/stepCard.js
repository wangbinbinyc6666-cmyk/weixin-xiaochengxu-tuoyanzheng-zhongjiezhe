Component({
  properties: {
    step: {
      type: Object,
      value: {},
    },
    index: {
      type: Number,
      value: 0,
    },
    completed: {
      type: Boolean,
      value: false,
    },
    skipped: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    onComplete() {
      this.triggerEvent("complete", { index: this.properties.index });
    },
    onSkip() {
      this.triggerEvent("skip", { index: this.properties.index });
    },
  },
});
