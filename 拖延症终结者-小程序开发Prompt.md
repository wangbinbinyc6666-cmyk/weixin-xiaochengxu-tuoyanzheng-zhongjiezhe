# 微信小程序 - 「拖延症终结者」产品需求与编程指南

## 1. 产品概述

**产品名称**：拖延症终结者
**产品类型**：微信小程序（云开发版）
**一句话描述**：用户输入困扰/拖延的事情，AI 自动拆解成 3-5 个 5-15 分钟可完成的具体步骤，并追踪完成情况。

---

## 2. 用户故事与核心流程

### 用户故事
小明躺在床上，一直想着"还没回复客户的消息"，越想越焦虑，越焦虑越不想动。打开小程序，输入这句话，AI 立刻拆解成：
1. "打开微信，找到客户对话框"（3分钟）
2. "写一句'抱歉刚才忙，收到您的消息了'"（5分钟）
3. "发送"（1分钟）

小明点击「开始执行」，一个个打卡，完成后看到今日完成率 100%，有了一点成就感。

### 核心流程（4步）

```
用户输入困扰 → AI 拆解步骤 → 用户打卡执行 → 每日复盘
```

---

## 3. 功能范围

### MVP 必须功能（第一版只做这些）

| 功能 | 描述 |
|------|------|
| **输入困扰** | 用户用文字描述自己的困扰或拖延的事 |
| **AI 拆解** | 调用 DeepSeek API，将困扰拆解为 3-5 个具体可执行的步骤 |
| **步骤打卡** | 每个步骤可标记「完成」或「跳过」，记录耗时 |
| **今日概览** | 显示今日完成了几个计划，总完成率 |
| **复盘页** | 展示历史数据：总计划数、完成率、常见拖延原因 |

### 不做的功能（砍掉）

- 社交分享
- 积分/等级系统
- 多人协作
- 复杂数据分析

---

## 4. 技术架构

```
前端：微信小程序（原生框架 + WXML/WXSS）
后端：微信云开发（云函数 + 云数据库）
AI：  DeepSeek API（deepseek-chat 模型）
```

**为什么选这个组合：**
- 微信云开发：免费额度足够，个人开发者不需要买服务器
- DeepSeek API：便宜（1000 tokens ≈ 0.1 元），效果够用

---

## 5. 数据库设计

### 集合 1：plans（计划/任务）

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 自动生成 |
| `task` | string | 用户输入的原始困扰 |
| `steps` | array | 拆解后的步骤数组 |
| `createdAt` | number | 创建时间（时间戳） |
| `completedSteps` | array | 已完成的步骤索引 |
| `skippedSteps` | array | 跳过的步骤索引 |
| `status` | string | ongoing（进行中）/ completed（已完成）/ abandoned（已放弃） |

**steps 数组结构：**

```json
[
  { "content": "打开微信，找到客户对话框", "estimate_minutes": 3, "actual_minutes": 0 },
  { "content": "写一句'抱歉刚才忙，收到您的消息了'", "estimate_minutes": 5, "actual_minutes": 0 }
]
```

### 集合 2：reviews（每日复盘）

| 字段 | 类型 | 说明 |
|------|------|------|
| `_id` | string | 自动生成 |
| `date` | string | 日期，格式 "YYYY-MM-DD" |
| `totalPlans` | number | 当日总计划数 |
| `completedPlans` | number | 当日完成数 |
| `totalSteps` | number | 当日总步骤数 |
| `completedSteps` | number | 当日完成步骤数 |
| `skipRate` | number | 跳过率（衡量拖延程度） |
| `commonBlocks` | array | 常见卡点（用户手动选或AI总结） |

---

## 6. 云函数设计

### 云函数 1：analyzeTask（AI 拆解任务）

**入口：** `cloudfunctions/analyzeTask/index.js`

**请求参数：**

```json
{ "task": "躺在床上想事情，没有回复客户的消息" }
```

**处理逻辑：**
1. 调用 DeepSeek API，发送 prompt 让它拆解任务
2. 解析返回的 JSON，提取 steps 数组
3. 将结果存入 plans 集合
4. 返回 planId 和 steps

**DeepSeek Prompt：**

```
你是一个任务拆解助手。用户会告诉你一个困扰或他想拖延的事情。
请将其拆解成 3-5 个具体的小步骤，每步控制在 5-15 分钟内可以完成。

要求：
- 每步必须是立刻可以执行的动作（不是"想办法"而是"打开XX做XX"）
- 控制在 5-15 分钟
- 用 JSON 格式返回，不要有其他文字

返回格式：
{
  "steps": [
    {"content": "步骤内容", "estimate_minutes": 预估分钟数},
    ...
  ]
}

用户困扰：{user_input}
```

**响应：**

```json
{
  "planId": "云数据库记录_id",
  "steps": [...]
}
```

### 云函数 2：saveStepResult（保存步骤执行结果）

**入口：** `cloudfunctions/saveStepResult/index.js`

**请求参数：**

```json
{
  "planId": "计划_id",
  "stepIndex": 0,
  "action": "complete",
  "actualMinutes": 5
}
```

**处理逻辑：**
1. 根据 planId 找到计划记录
2. 更新 completedSteps 或 skippedSteps 数组
3. 如果所有步骤都已操作完，更新 status 为 completed
4. 累计更新 reviews 集合中的今日统计

### 云函数 3：getTodayStats（获取今日统计）

**入口：** `cloudfunctions/getTodayStats/index.js`

**处理逻辑：**
1. 获取今天的日期字符串
2. 查询 reviews 集合中今天的记录
3. 查询 plans 集合中今天创建且 status=ongoing 的记录
4. 返回统计数据

**响应：**

```json
{
  "todayPlans": [...],
  "totalPlans": 5,
  "completedPlans": 3,
  "completionRate": 0.6
}
```

---

## 7. 前端页面设计

### 页面 1：首页（pages/index/index）

**功能：**
- 顶部：像素风格管家形象 + 问候语（"有什么困扰？说出来，我帮你拆解"）
- 中部：大文本输入框，placeholder="躺在床上想事情，没有回复客户的消息..."
- 底部：「创建计划」按钮

**交互：**
1. 用户输入文字，点击「创建计划」
2. 显示 loading（"管家正在帮你拆解..."）
3. 成功后跳转到计划详情页

### 页面 2：计划详情页（pages/plan/plan）

**功能：**
- 显示原始困扰文字
- 显示 AI 拆解的步骤列表（每个步骤一张卡片）
- 每个步骤有「完成」「跳过」按钮
- 步骤下方显示预估耗时

**交互：**
1. 用户点击步骤卡片展开详情
2. 点击「完成」→ 记录实际耗时 → 更新 UI
3. 点击「跳过」→ 标记跳过 → 询问原因（可选）
4. 所有步骤操作完后 → 弹出「复盘引导」

### 页面 3：复盘页（pages/review/review）

**功能：**
- 今日完成率（环形图或进度条）
- 完成 vs 跳过 vs 放弃 统计
- 历史数据趋势（最近7天完成率折线图）
- 常见卡点标签云

**交互：**
- 下拉刷新获取最新数据
- 点击某天可看当天详细记录

### 页面 4：我的（pages/me/me）

**功能：**
- 累计完成计划数
- 连续打卡天数
- 常见拖延类型统计
- 设置（清除数据等）

---

## 8. UI 设计规范

### 配色方案

| 用途 | 色值 |
|------|------|
| 主色（primary） | #4A90E2（蓝色，让人冷静） |
| 强调色（accent） | #7ED321（绿色，代表完成） |
| 警告色（warning） | #F5A623（橙色，提醒拖延） |
| 背景色（bg） | #F8F9FA（浅灰白） |
| 卡片背景 | #FFFFFF |
| 文字主色 | #333333 |
| 文字次色 | #999999 |

### 字体

| 用途 | 字号 | 字重 |
|------|------|------|
| 标题 | 18px | font-weight: 600 |
| 正文 | 14px | font-weight: 400 |
| 辅助文字 | 12px | color: #999999 |

### 间距规范

| 用途 | 数值 |
|------|------|
| 页面边距 | 32rpx |
| 卡片间距 | 24rpx |
| 卡片内边距 | 24rpx |
| 元素间距 | 16rpx |

### 组件风格

| 用途 | 数值 |
|------|------|
| 圆角 | 16rpx |
| 阴影 | 0 4rpx 16rpx rgba(0,0,0,0.08) |
| 按钮圆角 | 40rpx（胶囊按钮） |

### 像素管家图标

- 用 emoji 🤖 或 🏰 代替也行
- 正式版可以设计一个简单的像素小人

---

## 9. 文件结构

```
├── cloudfunctions/              # 云函数目录
│   ├── analyzeTask/
│   │   ├── index.js
│   │   └── package.json
│   ├── saveStepResult/
│   │   ├── index.js
│   │   └── package.json
│   └── getTodayStats/
│       ├── index.js
│       └── package.json
│
├── miniprogram/                 # 小程序前端
│   ├── app.js                   # 应用入口
│   ├── app.json                 # 应用配置
│   ├── app.wxss                 # 全局样式
│   ├── pages/
│   │   ├── index/               # 首页
│   │   │   ├── index.wxml
│   │   │   ├── index.wxss
│   │   │   └── index.js
│   │   ├── plan/                # 计划详情
│   │   │   ├── plan.wxml
│   │   │   ├── plan.wxss
│   │   │   └── plan.js
│   │   ├── review/              # 复盘页
│   │   │   ├── review.wxml
│   │   │   ├── review.wxss
│   │   │   └── review.js
│   │   └── me/                  # 我的
│   │       ├── me.wxml
│   │       ├── me.wxss
│   │       └── me.js
│   ├── components/              # 公共组件
│   │   └── stepCard/
│   │       ├── stepCard.wxml
│   │       ├── stepCard.wxss
│   │       └── stepCard.js
│   └── utils/
│       └── api.js               # 云函数调用封装
│
├── cloudbaserc.json             # 云开发配置
└── project.config.json          # 项目配置
```

---

## 10. 环境变量配置

在微信云开发控制台「环境变量」设置：

```
DEEPSEEK_API_KEY = sk-xxx…xxxx
```

---

## 11. 关键实现细节

### DeepSeek API 调用（云函数中）

```javascript
const fetch = require('node-fetch')

async function callDeepSeek(task) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: `你是一个任务拆解助手。..."
用户困扰：${task}`
      }]
    })
  })
  return await response.json()
}
```

### 云数据库权限

由于是用户自己的数据，建议开启「自定义安全规则」：

```json
{
  "plans": {
    "read": "doc._openid == auth.openid",
    "write": "doc._openid == auth.openid"
  }
}
```

---

## 12. 开发顺序建议

```
第1步：创建项目 → 开通云开发 → 建数据库集合
第2步：写云函数 analyzeTask（调通 DeepSeek API）
第3步：写首页（输入 → 调用 analyzeTask → 跳转详情）
第4步：写计划详情页（步骤展示 + 打卡功能）
第5步：写 saveStepResult 云函数
第6步：写复盘页（数据展示）
第7步：写「我的」页面（统计）
第8步：美化 UI + 测试
```

---

## 13. 测试账号

- 微信开发者工具自带模拟器
- 切换不同微信号测试数据隔离
- DeepSeek API 可以用测试 key 先跑通

---

## 请生成的代码清单

请帮我生成完整的微信小程序代码，包括：

1. **所有云函数（3个）**
   - `cloudfunctions/analyzeTask/index.js`
   - `cloudfunctions/saveStepResult/index.js`
   - `cloudfunctions/getTodayStats/index.js`

2. **所有前端页面（4个）**
   - `pages/index/`（首页 - 输入困扰）
   - `pages/plan/`（计划详情 - 步骤打卡）
   - `pages/review/`（复盘页）
   - `pages/me/`（我的页面）

3. **工具函数封装**
   - `utils/api.js`（云函数调用封装）

4. **应用入口**
   - `app.js`、`app.json`、`app.wxss`

5. **组件**
   - `components/stepCard/`（步骤卡片组件）

**代码要求：**
- 使用微信小程序原生框架
- 代码完整可运行，复制粘贴即可使用
- 添加必要的注释说明
- 错误处理完善（loading 状态、失败提示、网络错误处理）
- API Key 通过 `process.env` 读取，不硬编码
- 数据库操作使用 `wx.cloud` 调云函数方式
- 每个页面和云函数单独一个文件，方便复制
