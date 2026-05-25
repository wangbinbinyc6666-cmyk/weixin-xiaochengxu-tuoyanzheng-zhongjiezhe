const { analyzeTask } = require("../../utils/api");

const db = wx.cloud.database();

const ENCOURAGEMENTS = [
  "别怕，小步快跑，W 教练带你飞",
  "越是困难的事，越要拆开来看",
  "完成一个小步骤，就值得庆祝",
  "拖延的反面不是勤奋，是开始",
  "W 教练相信你可以的！",
];

Page({
  data: {
    task: "",
    loading: false,
    recentPlans: [],
  },

  onShow() {
    this.loadRecentPlans();
  },

  loadRecentPlans() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    db.collection("plans")
      .where({
        createdAt: db.command.gte(todayStart.getTime()).and(db.command.lt(todayEnd.getTime())),
      })
      .orderBy("createdAt", "desc")
      .get()
      .then((res) => {
        this.setData({ recentPlans: res.data || [] });
      })
      .catch((err) => {
        console.error("[index] loadRecentPlans failed:", err);
      });
  },

  onInput(e) {
    this.setData({ task: e.detail.value });
  },

  onSubmit() {
    console.log("[index] onSubmit called, task:", this.data.task);
    const task = this.data.task.trim();
    if (!task) {
      wx.showToast({
        title: "先告诉 W 教练你的困扰吧",
        icon: "none",
        duration: 2000,
      });
      return;
    }

    wx.showLoading({ title: "W 教练思考中..." });
    this.setData({ loading: true });

    console.log("[index] calling analyzeTask...");
    analyzeTask(task)
      .then((res) => {
        console.log("[index] analyzeTask success, planId:", res.planId);
        wx.hideLoading();
        wx.navigateTo({
          url: `/pages/plan/plan?planId=${res.planId}`,
        });
      })
      .catch((err) => {
        console.error("[index] analyzeTask failed:", err);
        wx.hideLoading();
        wx.showModal({
          title: "拆解失败",
          content: err.message || "请检查云函数是否部署、DeepSeek API Key 是否配置",
          showCancel: false,
        });
      })
      .finally(() => {
        this.setData({ loading: false, task: "" });
      });
  },

  onTapPlan(e) {
    const planId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/plan/plan?planId=${planId}`,
    });
  },
});
