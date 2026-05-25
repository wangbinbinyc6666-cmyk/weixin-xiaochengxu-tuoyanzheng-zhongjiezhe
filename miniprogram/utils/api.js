/**
 * 云函数调用封装
 */

function callCloudFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => {
        if (res.result && res.result.success) {
          resolve(res.result);
        } else {
          const errMsg =
            (res.result && res.result.error) || "请求失败，请稍后重试";
          reject(new Error(errMsg));
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || "网络请求失败"));
      },
    });
  });
}

function analyzeTask(task) {
  return callCloudFunction("analyzeTask", { task });
}

function saveStepResult(planId, stepIndex, action, actualMinutes) {
  return callCloudFunction("saveStepResult", {
    planId,
    stepIndex,
    action,
    actualMinutes,
  });
}

function getTodayStats(range = "today") {
  return callCloudFunction("getTodayStats", { range });
}

module.exports = {
  analyzeTask,
  saveStepResult,
  getTodayStats,
};
