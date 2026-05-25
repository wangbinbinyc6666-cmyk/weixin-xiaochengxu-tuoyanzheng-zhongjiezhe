const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const { range } = event || {}; // "today" | "week" | "all"

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  try {
    // Get today's plans
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const todayEnd = todayStart + 86400000;

    const plansRes = await db
      .collection("plans")
      .where({
        _openid: wxContext.OPENID,
        createdAt: _.gte(todayStart).and(_.lt(todayEnd)),
      })
      .get();

    const plans = plansRes.data;

    const totalPlans = plans.length;
    const completedPlans = plans.filter((p) => p.status === "completed").length;
    const ongoingPlans = plans.filter((p) => p.status === "ongoing").length;
    const abandonedPlans = plans.filter((p) => p.status === "abandoned").length;

    let totalSteps = 0;
    let completedStepsCount = 0;
    let skippedStepsCount = 0;

    plans.forEach((p) => {
      totalSteps += p.steps.length;
      completedStepsCount += (p.completedSteps || []).length;
      skippedStepsCount += (p.skippedSteps || []).length;
    });

    // Get or create today's review
    const reviewRes = await db
      .collection("reviews")
      .where({ date: todayStr, _openid: wxContext.OPENID })
      .get();

    // Get historical stats (last 7 days)
    let weeklyTrend = [];
    if (range === "week" || range === "all") {
      const sevenDaysAgo = new Date(todayStart - 6 * 86400000);
      const historyRes = await db
        .collection("reviews")
        .where({
          _openid: wxContext.OPENID,
          date: _.gte(
            `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(sevenDaysAgo.getDate()).padStart(2, "0")}`
          ),
        })
        .orderBy("date", "asc")
        .get();

      weeklyTrend = historyRes.data.map((r) => ({
        date: r.date,
        completionRate:
          r.totalSteps > 0
            ? Math.round((r.completedSteps / r.totalSteps) * 100)
            : 0,
      }));
    }

    // Get all-time stats for "my" page
    let allTimeStats = null;
    if (range === "all") {
      const allPlansRes = await db
        .collection("plans")
        .where({ _openid: wxContext.OPENID })
        .get();

      const allPlans = allPlansRes.data;
      allTimeStats = {
        totalPlans: allPlans.length,
        completedPlans: allPlans.filter((p) => p.status === "completed").length,
        totalSteps: allPlans.reduce((sum, p) => sum + p.steps.length, 0),
        completedSteps: allPlans.reduce(
          (sum, p) => sum + (p.completedSteps || []).length,
          0
        ),
      };

      // Count consecutive days
      const allReviews = await db
        .collection("reviews")
        .where({ _openid: wxContext.OPENID })
        .orderBy("date", "desc")
        .get();

      let streak = 0;
      const checkDate = new Date(todayStart);
      for (const r of allReviews.data) {
        const expectedStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
        if (r.date === expectedStr) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
      allTimeStats.streak = streak;
    }

    return {
      success: true,
      today: {
        date: todayStr,
        totalPlans,
        completedPlans,
        ongoingPlans,
        abandonedPlans,
        totalSteps,
        completedSteps: completedStepsCount,
        skippedSteps: skippedStepsCount,
        completionRate:
          totalSteps > 0
            ? Math.round((completedStepsCount / totalSteps) * 100)
            : 0,
      },
      plans,
      review: reviewRes.data[0] || null,
      weeklyTrend,
      allTimeStats,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
