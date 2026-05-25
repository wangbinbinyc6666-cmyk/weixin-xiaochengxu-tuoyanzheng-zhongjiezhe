const db = wx.cloud.database();

Page({
  data: {
    allTimeStats: {
      totalPlans: 0,
      completedPlans: 0,
      totalSteps: 0,
      completedSteps: 0,
      streak: 0,
      completionRate: 0,
    },
    recentPlans: [],
    loading: true,
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    this.setData({ loading: true });

    db.collection("plans")
      .orderBy("createdAt", "desc")
      .get()
      .then((res) => {
        const plans = res.data || [];

        // All-time stats
        let totalSteps = 0;
        let completedSteps = 0;
        let completedPlans = 0;

        plans.forEach((p) => {
          totalSteps += p.steps.length;
          completedSteps += (p.completedSteps || []).length;
          if (p.status === "completed") completedPlans++;
        });

        // Compute streak (consecutive days with activity)
        const activityDays = new Set();
        plans.forEach((p) => {
          const d = new Date(p.createdAt);
          activityDays.add(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
          );
        });

        let streak = 0;
        const today = new Date();
        const check = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        while (true) {
          const key = `${check.getFullYear()}-${String(check.getMonth() + 1).padStart(2, "0")}-${String(check.getDate()).padStart(2, "0")}`;
          if (activityDays.has(key)) {
            streak++;
            check.setDate(check.getDate() - 1);
          } else {
            break;
          }
        }

        this.setData({
          allTimeStats: {
            totalPlans: plans.length,
            completedPlans,
            totalSteps,
            completedSteps,
            streak,
            completionRate:
              totalSteps > 0
                ? Math.round((completedSteps / totalSteps) * 100)
                : 0,
          },
          recentPlans: plans.slice(0, 5),
          loading: false,
        });
      })
      .catch((err) => {
        console.error("[me] loadData failed:", err);
        this.setData({ loading: false });
      });
  },

  onTapPlan(e) {
    const planId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/plan/plan?planId=${planId}`,
    });
  },

  onClearData() {
    wx.showModal({
      title: "确认清除",
      content: "此操作将清除所有数据，不可恢复。确定要继续吗？",
      success: (modalRes) => {
        if (!modalRes.confirm) return;

        wx.showLoading({ title: "清除中..." });

        // Fetch all plan IDs then delete them
        db.collection("plans")
          .get()
          .then((res) => {
            const plans = res.data || [];
            const deletions = plans.map((p) =>
              db.collection("plans").doc(p._id).remove()
            );
            return Promise.all(deletions);
          })
          .then(() => {
            wx.hideLoading();
            wx.showToast({ title: "已清除", icon: "success" });
            this.loadData();
          })
          .catch((err) => {
            console.error("[me] clearData failed:", err);
            wx.hideLoading();
            wx.showToast({ title: "清除失败", icon: "none" });
          });
      },
    });
  },

  onAbout() {
    wx.showModal({
      title: "关于",
      content:
        "拖延症终结者 v1.0\n\nAI 驱动的任务拆解工具，帮你把大困扰变成小步骤，一步步战胜拖延。",
      showCancel: false,
    });
  },
});
