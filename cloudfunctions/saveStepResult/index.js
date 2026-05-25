const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { planId, stepIndex, action, actualMinutes } = event;
  const wxContext = cloud.getWXContext();

  if (!planId || stepIndex == null || !action) {
    return { success: false, error: "参数不完整" };
  }

  if (!["complete", "skip"].includes(action)) {
    return { success: false, error: "无效的操作类型" };
  }

  try {
    const planRes = await db.collection("plans").doc(planId).get();
    const plan = planRes.data;

    if (!plan || plan._openid !== wxContext.OPENID) {
      return { success: false, error: "计划不存在" };
    }

    // Update completedSteps or skippedSteps
    const updateData = {};
    if (action === "complete") {
      updateData.completedSteps = _.addToSet(stepIndex);
    } else {
      updateData.skippedSteps = _.addToSet(stepIndex);
    }

    // Update actual_minutes for this step
    if (actualMinutes != null && plan.steps[stepIndex]) {
      const stepKey = `steps.${stepIndex}.actual_minutes`;
      updateData[stepKey] = actualMinutes;
    }

    await db.collection("plans").doc(planId).update({ data: updateData });

    // Re-fetch to check if all steps are handled
    const updatedPlan = await db.collection("plans").doc(planId).get();
    const totalSteps = updatedPlan.data.steps.length;
    const handledCount =
      (updatedPlan.data.completedSteps || []).length +
      (updatedPlan.data.skippedSteps || []).length;

    if (handledCount >= totalSteps) {
      await db.collection("plans").doc(planId).update({
        data: { status: "completed" },
      });
    }

    // Update today's review stats
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const reviewRes = await db
      .collection("reviews")
      .where({ date: dateStr, _openid: wxContext.OPENID })
      .get();

    if (reviewRes.data.length > 0) {
      // Update existing review
      const review = reviewRes.data[0];
      const isComplete = action === "complete";
      await db
        .collection("reviews")
        .doc(review._id)
        .update({
          data: {
            completedSteps: isComplete
              ? _.inc(1)
              : review.completedSteps,
            totalStepsHandled: _.inc(1),
          },
        });
    }

    return { success: true, status: updatedPlan.data.status };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
