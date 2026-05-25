const db = wx.cloud.database();

function getDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDateRange(daysBack) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

Page({
  data: {
    todayData: {
      totalPlans: 0,
      completedPlans: 0,
      ongoingPlans: 0,
      totalSteps: 0,
      completedSteps: 0,
      skippedSteps: 0,
      completionRate: 0,
    },
    todayPlans: [],
    weeklyTrend: [],
    loading: true,
  },

  onShow() {
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  loadData() {
    this.setData({ loading: true });

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const todayEnd = todayStart + 86400000;

    // Fetch today's plans
    const todayPromise = db
      .collection("plans")
      .where({
        createdAt: db.command.gte(todayStart).and(db.command.lt(todayEnd)),
      })
      .orderBy("createdAt", "desc")
      .get();

    // Fetch last 7 days' plans for trend
    const { start } = getDateRange(6);
    const weekPromise = db
      .collection("plans")
      .where({
        createdAt: db.command.gte(start.getTime()),
      })
      .orderBy("createdAt", "asc")
      .get();

    return Promise.all([todayPromise, weekPromise])
      .then(([todayRes, weekRes]) => {
        const todayPlans = todayRes.data || [];
        const allWeekPlans = weekRes.data || [];

        // Compute today stats
        let totalSteps = 0;
        let completedSteps = 0;
        let skippedSteps = 0;
        let completedPlans = 0;
        let ongoingPlans = 0;

        todayPlans.forEach((p) => {
          totalSteps += p.steps.length;
          completedSteps += (p.completedSteps || []).length;
          skippedSteps += (p.skippedSteps || []).length;
          if (p.status === "completed") completedPlans++;
          if (p.status === "ongoing") ongoingPlans++;
        });

        // Compute weekly trend
        const trendMap = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date(todayStart - (6 - i) * 86400000);
          trendMap[getDateStr(d)] = { total: 0, done: 0 };
        }

        allWeekPlans.forEach((p) => {
          const d = new Date(p.createdAt);
          const key = getDateStr(d);
          if (trendMap[key] != null) {
            trendMap[key].total += p.steps.length;
            trendMap[key].done += (p.completedSteps || []).length;
          }
        });

        const weeklyTrend = Object.entries(trendMap).map(([date, v]) => ({
          date,
          completionRate: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
        }));

        this.setData({
          todayData: {
            totalPlans: todayPlans.length,
            completedPlans,
            ongoingPlans,
            totalSteps,
            completedSteps,
            skippedSteps,
            completionRate:
              totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
          },
          todayPlans,
          weeklyTrend,
          loading: false,
        });
      })
      .catch((err) => {
        console.error("[review] loadData failed:", err);
        this.setData({ loading: false });
      });
  },

  onTapPlan(e) {
    const planId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/plan/plan?planId=${planId}`,
    });
  },
});
