# Agent-WeChat-SDK 最终设计方案

> 本文档回答四个核心问题，并给出完整架构图和实现路线。

---

## Q1. 这是什么类型的微信账号？

**结论：是一个普通个人微信号，不是公众号，也不是企业微信。**

### 三种接入方式对比

| 方式 | 账号类型 | 合法性 | 用户如何联系 bot |
|------|---------|--------|----------------|
| **ClawBot / iLink（本项目）** | 普通个人微信号 | ✅ 官方 API | 加好友，直接私聊 |
| 企业微信 API | 企业微信号 | ✅ 官方 API | 关注企业，服务号 |
| 公众号 API | 认证公众号 | ✅ 官方 API | 关注公众号，菜单/消息 |
| 逆向 iPad 协议 | 普通个人号 | ❌ 灰色地带 | 加好友 |

### 关键理解

```
Bot 账号 = 你自己的一个微信个人号（建议专门注册一个）
用户 = 把这个微信号加为"好友"，然后像和真人聊天一样发消息
```

- 用户体验：**和发普通微信消息完全一样**，没有任何特殊感知
- Bot 账号从外面看就是个普通人的微信号
- iLink 协议（智联）是腾讯在 npm `@tencent-weixin/openclaw-weixin` 里内置的官方 HTTP API
- 域名 `ilinkai.weixin.qq.com`，有《微信ClawBot功能使用条款》法律文件背书

### 登录原理

```
开发者机器
    │
    │  pnpm run login
    ▼
iLink API → 生成 QR 码 URL
    │
    ▼  在终端显示二维码
开发者用 Bot 专用微信号扫码
    │
    ▼  iLink 服务器确认
返回 bot_token + ilink_bot_id（保存到 ~/.openclaw/）
    │
    ▼
bot_token 有效，开始接收/发送消息
```

---

## Q2. 任意 Agent 都能接入的 SDK 接口设计

### 核心原则：极简接口，无限扩展

整个 SDK 只暴露一个接口，任何 Agent 实现它即可：

```typescript
// 这是唯一需要实现的接口
interface Agent {
  chat(request: ChatRequest): Promise<ChatResponse>;
}

interface ChatRequest {
  conversationId: string;  // 用户微信ID，用于区分对话/维护历史
  text: string;            // 用户发送的文本
  media?: {                // 用户发的媒体（已自动下载解密到本地）
    type: "image" | "audio" | "video" | "file";
    filePath: string;      // 本地文件路径
    mimeType: string;
    fileName?: string;
  };
}

interface ChatResponse {
  text?: string;           // 回复文本（支持 markdown，自动转纯文本）
  media?: {                // 回复媒体（支持本地路径或 https URL）
    type: "image" | "video" | "file";
    url: string;
    fileName?: string;
  };
}
```

### 内置 Adapters

```typescript
// Claude Adapter（推荐）
import { ClaudeAdapter } from "@agent-wechat/adapters";
const agent = new ClaudeAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-sonnet-4-6",
  systemPrompt: "你是一个助手...",
});

// OpenAI-compatible Adapter（DeepSeek/Qwen/任意兼容接口）
import { OpenAIAdapter } from "@agent-wechat/adapters";
const agent = new OpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
});

// 自定义 Agent（最自由）
const myAgent: Agent = {
  async chat(req) {
    // 你的任何逻辑
    const reply = await myAIService.call(req.text);
    return { text: reply };
  }
};

// 启动，三行搞定
import { WeChatInterface } from "@agent-wechat/core";
const wechat = new WeChatInterface(myAgent);
await wechat.login();
await wechat.start();
```

---

## Q3. 普通用户完整操作流程

### 角色一：Bot 运营者（开发者/部署者）

```
第一步：准备账号
  └─ 注册一个专用微信个人号（建议不用自己常用的号）

第二步：安装 & 配置
  └─ pnpm add @agent-wechat/cli
  └─ 配置 .env（AI 后端 API Key、系统提示词等）

第三步：登录授权（一次性）
  └─ npx wechat-agent login
  └─ 终端显示二维码 → 用 Bot 微信号扫码
  └─ 看到 "✅ 与微信连接成功！" → 完成
  └─ token 自动保存，下次启动无需重新扫码

第四步：启动 Bot
  └─ npx wechat-agent start
  └─ Bot 进入监听状态，等待用户发消息

第五步：通知用户
  └─ 把 Bot 微信号的二维码/微信号分享给用户
  └─ 告诉用户：加这个微信好友，就能用 AI 了
```

### 角色二：最终用户（普通微信用户）

```
第一步：添加好友
  └─ 扫描运营者分享的微信二维码，或搜索微信号
  └─ 发送好友申请，等待通过（bot 可配置自动通过）

第二步：直接聊天（和真人完全一样）
  └─ 发文字 → 收到 AI 文字回复
  └─ 发图片 → AI 识别图片内容并回复
  └─ 发语音 → 自动转文字，AI 处理后文字回复
  └─ 发文件 → AI 分析文件内容
  └─ 看到对方"正在输入..." → AI 在处理中

第三步：无感体验
  └─ 无需下载 App，无需注册账号
  └─ 微信已有，直接用
  └─ 体验和和真人朋友聊天完全一致
```

### 时序图

```
用户                    微信服务器              Bot 服务器              AI 后端
 │                          │                      │                     │
 │── 发消息 ───────────────>│                      │                     │
 │                          │── iLink long-poll ──>│                     │
 │                          │<─ 返回消息 ──────────│                     │
 │                          │                      │── chat(request) ───>│
 │                          │                      │<─ ChatResponse ──────│
 │                          │<─ sendmessage ───────│                     │
 │<─ 收到回复 ──────────────│                      │                     │
```

---

## Q4. 两个参考仓库如何使用？

### 参考仓库梳理

| 仓库 | 作者 | 定位 | 代码量 |
|------|------|------|--------|
| `mason0510/wechat-agent-bridge` | mason0510 | 完整 SDK，协议封装，多 adapter | ~2000 行 |
| `hao-ji-xing/cc-weixin` | 好记星.ai | 极简 Claude Code Agent 接入 | ~200 行 |

### 策略：借鉴协议 + 重用 SDK，自建应用层

```
不做：fork 后直接用（依赖外部维护，版本漂移风险）
不做：完全重写 iLink 协议层（重复造轮子）

做：
  1. wechat-agent-bridge 作为 git submodule（固定版本，可本地修改）
  2. 直接引用其 weixin-agent-sdk 的 Agent 接口
  3. 我们的价值在 应用层：adapters / 配置管理 / CLI / iDoris 集成
  4. cc-weixin 作为参考，学习其极简设计哲学
```

**为什么选 submodule 而非 npm 依赖：**
- `weixin-agent-sdk` 尚未发布到 npm（v0.1.0，无 registry 记录）
- submodule 可以固定 commit，也可以 patch
- 将来若发布到 npm 可无缝切换

---

## 未来完整架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          WeChat Users                                    │
│                   (普通微信用户，加好友后直接私聊)                         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │  个人号私聊消息
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│            腾讯 iLink 官方服务器 (ilinkai.weixin.qq.com)                  │
│                    ClawBot / OpenClaw 框架                               │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │  HTTP/JSON Bearer Token
                               │  长轮询 (35s) / AES-128-ECB 媒体加密
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│          weixin-agent-sdk  [git submodule: wechat-agent-bridge]          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  协议层（不需要修改）                                              │   │
│  │  • 扫码登录 & token 持久化                                         │   │
│  │  • 长轮询消息循环                                                  │   │
│  │  • 媒体下载/解密/转码(SILK→WAV)                                   │   │
│  │  • 消息发送/媒体上传/typing 指示器                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  暴露：Agent interface { chat(req): Promise<resp> }                      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │  Agent interface
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    Agent-WeChat-SDK（本项目）                             │
│                                                                          │
│  packages/core/                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  WeChatInterface                                                   │   │
│  │  • login()  — 封装扫码登录                                         │   │
│  │  • start()  — 注入 Agent，启动消息循环                              │   │
│  │  • config   — 统一配置管理（apiKey, model, prompt, 白名单等）       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  packages/adapters/                                                      │
│  ┌───────────────────┐  ┌────────────────────┐  ┌───────────────────┐  │
│  │  ClaudeAdapter    │  │  OpenAIAdapter      │  │  CustomAdapter    │  │
│  │                   │  │  (任意兼容接口)      │  │  (模板基类)        │  │
│  │ • Anthropic SDK   │  │ • BaseURL 可配置    │  │ • 继承并覆写       │  │
│  │ • 多轮对话历史     │  │ • 多轮历史          │  │  chat() 即可       │  │
│  │ • vision 支持     │  │ • vision 支持       │  │                   │  │
│  │ • 流式输出        │  │                     │  │                   │  │
│  └───────────────────┘  └────────────────────┘  └───────────────────┘  │
│                                                                          │
│  packages/cli/ (standalone)                                              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  npx wechat-agent login                                           │   │
│  │  npx wechat-agent start --adapter claude --model claude-sonnet-4-6│   │
│  │  npx wechat-agent start --adapter openai --base-url ...           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────┬────────────────────────────┬────────────────────────────┘
               │                            │
               ▼                            ▼
┌──────────────────────┐        ┌─────────────────────────────────────────┐
│  独立使用             │        │  iDoris-SDK 集成                         │
│                      │        │                                          │
│  任何项目：           │        │  import { WeChatInterface }              │
│  import { ... }      │        │    from '@idoris/wechat'                 │
│  from '@agent-wechat/│        │                                          │
│         core'        │        │  class DorisAgent implements Agent {     │
│                      │        │    async chat(req) { ... }               │
│  3行代码接入微信       │        │  }                                       │
│                      │        │                                          │
│                      │        │  const wechat = new WeChatInterface(     │
│                      │        │    new DorisAgent()                      │
│                      │        │  );                                      │
└──────────────────────┘        └─────────────────────────────────────────┘
               │                            │
               ▼                            ▼
┌──────────────────────┐        ┌─────────────────────────────────────────┐
│  Anthropic Claude API│        │  iDoris Core / 任意自定义 Agent 逻辑      │
│  OpenAI API          │        │  工具调用 / RAG / MCP / 工作流             │
│  任意 LLM API        │        │                                          │
└──────────────────────┘        └─────────────────────────────────────────┘
```

---

## 实现路线（分阶段）

### Phase 1 — MVP（可用）

```
目标：任何人能用 Claude 接入微信，3 步完成

packages/core/
  ├── WeChatInterface.ts   封装 login/start
  └── index.ts

packages/adapters/
  └── ClaudeAdapter.ts     Anthropic SDK，多轮对话，vision

packages/cli/
  ├── main.ts              login / start 命令
  └── .env.example

根目录：
  ├── package.json         pnpm workspace
  ├── pnpm-workspace.yaml
  └── docs/DESIGN.md      ← 本文档
```

### Phase 2 — 扩展

```
packages/adapters/
  └── OpenAIAdapter.ts     任意 OpenAI-compatible 接口

packages/core/
  ├── whitelist.ts         好友白名单（只响应指定用户）
  └── rateLimit.ts         频率限制（防止滥用）
```

### Phase 3 — iDoris 集成

```
packages/idoris/  (或发布为 @idoris/wechat)
  ├── DorisWeChatBridge.ts  适配 iDoris-sdk 的 Agent 实现
  └── index.ts
```

---

## 包结构 & 发布计划

| 包名 | 发布名 | 用途 |
|------|--------|------|
| packages/core | `@agent-wechat/core` | 核心封装，其他包的基础 |
| packages/adapters | `@agent-wechat/adapters` | Claude/OpenAI 等官方 adapter |
| packages/cli | `wechat-agent` (CLI) | `npx wechat-agent start` |
| packages/idoris | `@idoris/wechat` | iDoris-SDK 专用集成包 |

---

## 关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 底层协议层 | 直接复用 weixin-agent-sdk（submodule）| 避免重复实现 iLink 协议，专注应用层 |
| 接入方式 | ClawBot / 个人号 | 唯一合法的个人号 Bot 官方 API |
| 包管理 | pnpm workspace monorepo | 与 wechat-agent-bridge 结构一致 |
| 语言 | TypeScript | 与底层 SDK 保持一致 |
| Agent 接口 | 直接复用 `weixin-agent-sdk` 的 `Agent` interface | 最简化，不重复定义 |
| 对话历史 | 由各 Adapter 自行管理（Map<conversationId, history[]>）| 灵活，适配不同 AI 后端 |
| 媒体处理 | 全部委托给 weixin-agent-sdk | 加密、CDN、转码全部已实现 |

---

## 为什么选择 wechat-agent-bridge 而非官方包或自己实现

### 常见误解澄清

**wechat-agent-bridge 并不依赖 `@tencent-weixin/openclaw-weixin`。**

mason0510 的做法是：研究腾讯官方 npm 包的源码，把 iLink 的 HTTP 协议逆向出来，然后用原生 `fetch` 重新实现了一遍。官方包只是参考资料，不是运行时依赖（`package.json` 里只有一个依赖：`qrcode-terminal`）。

所以依赖链是：
```
我们的代码 → weixin-agent-sdk（本地 submodule）→ iLink HTTP API（腾讯服务器）
```
不是"同时依赖两个"，weixin-agent-sdk 本身就是 iLink 的客户端实现。

### 它省掉了什么

wechat-agent-bridge 是约 2000 行已经调通的协议胶水代码，覆盖了直接对接 iLink 时必须自己踩的所有坑：

| 自己写要踩的坑 | wechat-agent-bridge 已解决 |
|---|---|
| iLink 扫码登录流程（长轮询状态机）| ✅ |
| Bearer Token 鉴权 + 持久化 | ✅ |
| 消息长轮询（35s timeout、断线重连、3次失败退避）| ✅ |
| 媒体文件 AES-128-ECB 加密/解密 | ✅ |
| CDN 上传/下载完整流程 | ✅ |
| 微信私有 SILK 音频 → WAV 转码 | ✅ |
| session 过期自动处理（errcode -14）| ✅ |
| typing 指示器、markdown 转纯文本 | ✅ |

这些都是纯协议胶水，没有算法含量，但每个踩错一个就跑不通。选择复用它的唯一原因是**不想重复写这 2000 行**，我们的精力应该在应用层。

---

## 风险分析：iLink 协议变更后怎么办

### 风险描述

iLink 是腾讯的官方协议，协议本身可能随版本迭代发生变化（接口字段变动、鉴权方式升级、CDN 结构调整等）。一旦发生变化：

- 如果 mason0510 积极维护 → 更新 submodule commit 即可，无感
- 如果 mason0510 停止维护 → 我们需要自己修复底层协议代码

### 为什么这个风险可控

**关键：我们用的是 submodule，不是黑盒 npm 包。**

```
npm 包（黑盒）：协议变了 → 等作者更新 → 无法自救
submodule（源码）：协议变了 → 我们直接改源码 → 完全可控
```

具体应对流程：

```
1. 腾讯发布新版 @tencent-weixin/openclaw-weixin
        │
        ▼
2. diff 新旧版本，找出 HTTP 接口变更点
   （字段名、URL、鉴权 header、数据结构）
        │
        ▼
3. 在我们 fork 的 submodule 里对应修改
   主要集中在：
   • packages/sdk/src/api/api.ts      ← HTTP 请求
   • packages/sdk/src/api/types.ts    ← 数据结构
   • packages/sdk/src/auth/login-qr.ts ← 鉴权流程
        │
        ▼
4. 本地测试通过后，固定新 commit
   git -C wechat-agent-bridge commit -am "fix: iLink protocol v2 changes"
```

### 变更影响范围评估

iLink 的代码结构非常清晰，协议相关代码高度集中：

```
packages/sdk/src/
  api/api.ts        ← 所有 HTTP endpoint 定义（约 150 行）
  api/types.ts      ← 所有请求/响应数据结构（约 200 行）
  auth/login-qr.ts  ← 登录流程（约 180 行）
  cdn/              ← CDN 加密上传（约 200 行，AES 算法不会变）
```

就算 iLink 做了较大调整，核心改动范围也在 **500 行以内**，且逻辑直白，没有复杂抽象。

### 概率判断

iLink 是腾讯刚推出的官方 API，目前处于推广期：
- 短期内大规模破坏性变更的概率低（会影响所有已有开发者）
- 腾讯有动机保持稳定以吸引生态
- 就算变更，通常会有过渡期
- 最坏情况：我们 fork 维护自己的 submodule 分支，成本完全可接受
