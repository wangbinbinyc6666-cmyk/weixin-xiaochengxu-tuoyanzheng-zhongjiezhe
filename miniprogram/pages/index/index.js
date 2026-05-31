const { analyzeTask } = require("../../utils/api");

Page({
  data: {
    task: "",
    loading: false,
    inputFocused: false,
  },

  onInput(e) {
    this.setData({ task: e.detail.value });
  },

  onInputFocus() {
    this.setData({ inputFocused: true });
  },

  onInputBlur() {
    this.setData({ inputFocused: false });
  },

  onSubmit() {
    const task = this.data.task.trim();
    if (!task) {
      wx.showToast({
        title: "请输入你的困扰",
        icon: "none",
        duration: 2000,
      });
      return;
    }

    wx.showLoading({ title: "分析中..." });
    this.setData({ loading: true });

    analyzeTask(task)
      .then((res) => {
        wx.hideLoading();
        wx.navigateTo({
          url: `/pages/plan/plan?planId=${res.planId}`,
        });
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showModal({
          title: "拆解失败",
          content: err.message || "请检查云函数是否部署、DeepSeek API Key 是否配置",
          showCancel: false,
        });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },
});
