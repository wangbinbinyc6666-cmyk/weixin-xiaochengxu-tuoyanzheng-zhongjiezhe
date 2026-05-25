const cloud = require("wx-server-sdk");
const https = require("https");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

const SYSTEM_PROMPT = `你是一个任务拆解助手，名叫 W 教练。用户会告诉你一个困扰或他想拖延的事情。
请将其拆解成 3-5 个具体的小步骤，每步控制在 5-15 分钟内可以完成。

要求：
- 每步必须是立刻可以执行的动作（不是"想办法"而是"打开XX做XX"）
- 控制在 5-15 分钟
- 为每个步骤配一个最贴切的 emoji 图标（icon 字段）
- 用 JSON 格式返回，不要有其他文字

返回格式：
{
  "steps": [
    {"content": "步骤内容", "estimate_minutes": 预估分钟数, "icon": "🎯"},
    ...
  ]
}

按动作类型选 icon：
- 打开/查看 → 📱 💻 📂
- 写/发送 → ✍️ 📨 📝
- 整理/收拾 → 🧹 📦
- 思考/决定 → 💡 🤔
- 联系/沟通 → 📞 💬
- 动手做 → 🔧 🛠️
- 其他 → 📋 ✅`;

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(
              new Error(
                `DeepSeek API 返回错误 ${res.statusCode}: ${data.slice(0, 200)}`
              )
            );
          }
        } catch (e) {
          reject(new Error(`响应解析失败: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on("error", (e) => {
      reject(new Error(`网络请求失败: ${e.message}`));
    });

    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error("DeepSeek API 请求超时（25秒）"));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function callDeepSeek(task) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DeepSeek API Key 未配置");
  }

  const body = JSON.stringify({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `用户困扰：${task}` },
    ],
    temperature: 0.7,
    max_tokens: 1024,
  });

  const data = await httpRequest(
    "https://api.deepseek.com/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(body),
      },
    },
    body
  );

  const content = data.choices[0].message.content.trim();
  const jsonStr = content
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```$/i, "");

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`AI 返回内容解析失败: ${content}`);
  }

  if (
    !parsed.steps ||
    !Array.isArray(parsed.steps) ||
    parsed.steps.length === 0
  ) {
    throw new Error(`AI 未返回有效的步骤数组`);
  }

  return parsed.steps;
}

exports.main = async (event) => {
  const { task } = event;
  const wxContext = cloud.getWXContext();

  if (!task || !task.trim()) {
    return { success: false, error: "请输入困扰内容" };
  }

  try {
    const steps = await callDeepSeek(task.trim());

    const plan = {
      task: task.trim(),
      steps: steps.map((s) => ({
        content: s.content,
        estimate_minutes: s.estimate_minutes || 10,
        actual_minutes: 0,
        icon: s.icon || "📋",
      })),
      completedSteps: [],
      skippedSteps: [],
      status: "ongoing",
      createdAt: Date.now(),
      _openid: wxContext.OPENID,
    };

    const result = await db.collection("plans").add({ data: plan });

    return {
      success: true,
      planId: result._id,
      steps: plan.steps,
    };
  } catch (e) {
    return {
      success: false,
      error: e.message || "任务拆解失败，请稍后重试",
    };
  }
};
