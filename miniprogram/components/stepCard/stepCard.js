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

  data: {
    circleColor: "#3498DB",
    strikeAnimate: false,
  },

  lifetimes: {
    attached() {
      const COLORS = ["#3498DB", "#F39C12", "#2ECC71", "#9B59B6"];
      this.setData({
        circleColor: COLORS[this.properties.index % 4],
      });
    },
  },

  observers: {
    index(newIndex) {
      const COLORS = ["#3498DB", "#F39C12", "#2ECC71", "#9B59B6"];
      this.setData({
        circleColor: COLORS[newIndex % 4],
      });
    },

    completed(val) {
      if (val) {
        this.triggerStrikeAnimation();
      }
    },

    skipped(val) {
      if (val) {
        this.triggerStrikeAnimation();
      }
    },
  },

  methods: {
    triggerStrikeAnimation() {
      // First ensure strike-line (width: 0) is in DOM, then animate
      this.setData({ strikeAnimate: false });
      setTimeout(() => {
        this.setData({ strikeAnimate: true });
      }, 30);
    },

    onComplete() {
      if (this.properties.completed || this.properties.skipped) return;
      this.playSound("complete.mp3");
      this.triggerEvent("complete", { index: this.properties.index });
    },

    onSkip() {
      if (this.properties.completed || this.properties.skipped) return;
      this.playSound("skip.mp3");
      this.triggerEvent("skip", { index: this.properties.index });
    },

    playSound(filename) {
      try {
        const audio = wx.createInnerAudioContext();
        audio.src = `/images/sounds/${filename}`;
        audio.play();
      } catch (e) {
        // Silently ignore audio errors
      }
    },
  },
});
