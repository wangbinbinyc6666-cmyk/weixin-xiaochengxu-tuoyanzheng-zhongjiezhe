const db = wx.cloud.database();
const _ = db.command;

const ENCOURAGEMENTS = [
  "加油！每完成一步，就离目标更近了 💪",
  "W 教练看着你呢，这个步骤很简单",
  "别想太多，先把这个做完再说",
  "一步一个脚印，拖延症就是这样被打败的",
  "这个做完就奖励自己一杯咖啡吧 ☕",
];

Page({
  data: {
    planId: "",
    plan: null,
    completedSteps: [],
    skippedSteps: [],
    handledCount: 0,
    totalSteps: 0,
    completionPercent: 0,
    loading: true,
    encouragement: "",
    showReward: false,
    completionDate: "",
    completionTime: "",
  },

  onLoad(options) {
    const planId = options.planId;
    if (!planId) {
      this.setData({ loading: false });
      return;
    }
    this.setData({
      planId,
      encouragement:
        ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)],
    });
    this.loadPlan();
  },

  loadPlan() {
    this.setData({ loading: true });
    db.collection("plans")
      .doc(this.data.planId)
      .get()
      .then((res) => {
        const plan = res.data;
        if (plan) {
          const completedSteps = plan.completedSteps || [];
          const skippedSteps = plan.skippedSteps || [];
          this.setData({
            plan,
            completedSteps,
            skippedSteps,
            handledCount: completedSteps.length + skippedSteps.length,
            totalSteps: plan.steps.length,
            completionPercent: Math.round(
              ((completedSteps.length + skippedSteps.length) /
                plan.steps.length) *
                100
            ),
          });
        }
        this.setData({ loading: false });
      })
      .catch((err) => {
        console.error("[plan] loadPlan failed:", err);
        this.setData({ loading: false });
        wx.showToast({ title: "加载计划失败", icon: "none" });
      });
  },

  onStepComplete(e) {
    const index = e.detail.index;

    this.setData({ showReward: true });
    setTimeout(() => {
      this.setData({ showReward: false });
    }, 2000);

    this.updateStep(index, "complete");
  },

  onStepSkip(e) {
    const index = e.detail.index;

    wx.showActionSheet({
      itemList: ["太难了", "没时间", "不想做", "先跳过"],
      success: () => {
        this.updateStep(index, "skip");
      },
      fail: () => {
        this.updateStep(index, "skip");
      },
    });
  },

  updateStep(index, action) {
    const { planId, plan } = this.data;

    // Update local state immediately
    const completedSteps = [...this.data.completedSteps];
    const skippedSteps = [...this.data.skippedSteps];

    if (action === "complete") {
      if (!completedSteps.includes(index)) completedSteps.push(index);
    } else {
      if (!skippedSteps.includes(index)) skippedSteps.push(index);
    }

    const handledCount = completedSteps.length + skippedSteps.length;
    const totalSteps = plan.steps.length;
    const completionPercent = Math.round((handledCount / totalSteps) * 100);

    const isCompleted = handledCount >= totalSteps;
    const updatedPlan = { ...plan };
    if (isCompleted) {
      updatedPlan.status = "completed";
      const now = new Date();
      this.setData({
        completionDate: `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`,
        completionTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      });
    }

    this.setData({
      plan: updatedPlan,
      completedSteps,
      skippedSteps,
      handledCount,
      completionPercent,
    });

    if (!isCompleted) {
      const next =
        ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
      this.setData({ encouragement: next });
    }

    // Persist to database
    const updateData = {};
    if (action === "complete") {
      updateData.completedSteps = _.addToSet(index);
    } else {
      updateData.skippedSteps = _.addToSet(index);
    }
    if (isCompleted) {
      updateData.status = "completed";
    }

    db.collection("plans")
      .doc(planId)
      .update({ data: updateData })
      .then(() => {
        if (isCompleted) {
          wx.showToast({ title: "全部完成！", icon: "success", duration: 2000 });
        } else {
          wx.showToast({
            title: action === "complete" ? "已完成" : "已跳过",
            icon: "success",
            duration: 1000,
          });
        }
      })
      .catch((err) => {
        console.error("[plan] updateStep failed:", err);
        wx.showToast({ title: "保存失败", icon: "none" });
      });
  },

  onBackHome() {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },
});
