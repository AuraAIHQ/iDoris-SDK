# Agent-WeChat-SDK

> WeChat shell for AI agents — let any agent talk to WeChat users via the official iLink protocol.

把任意 Agent 接入个人微信号，普通用户加好友后即可对话。运行在你自己的机器上（Mac mini 24/7 即可），无需公网 webhook。

## 仓库定位

本仓库是一个 **微信壳**（shell）：负责把 WeChat 协议层和 Agent 业务逻辑解耦。

- 协议层 → `wechat-agent-bridge/`（submodule，封装腾讯官方 iLink 协议）
- 壳层 → `packages/core`、`packages/cli`（本仓库提供）
- Agent 业务逻辑 → `agents/simple-agent/`（submodule，独立仓库，可自由替换）

任何实现 `Agent` 接口（`chat(req) → resp`）的代码都能挂到这个壳上。

## 架构

```
WeChat 用户
    │ 加好友、发消息
    ▼
腾讯 iLink 服务器 (官方)
    │ HTTP / 长轮询
    ▼
wechat-agent-bridge   ← submodule（协议层）
    │ Agent interface
    ▼
@agent-wechat/core    ← packages/core（壳封装）
    │
    ├─ @agent-wechat/cli         ← packages/cli（命令行入口）
    │
    └─ @aura/simple-agent        ← agents/simple-agent（业务 agent）
       └─ StorageAgent           Level 1 规则 agent，存文件
```

详见 [`docs/DESIGN.md`](./docs/DESIGN.md)。

## 快速开始

```bash
git clone --recursive git@github.com:<your-org>/Agent-WeChat-SDK.git
cd Agent-WeChat-SDK
pnpm install

# 一次性扫码登录（用专用微信号扫终端二维码）
pnpm wechat:login

# 启动壳 + StorageAgent
cp packages/cli/.env.example packages/cli/.env
$EDITOR packages/cli/.env   # 改 STORAGE_BASE_PATH 等
pnpm wechat:start
```

启动后，让朋友把这个微信号加为好友，发图片/视频/文件/文字给它，就会自动存到 `STORAGE_BASE_PATH` 指定目录下，按用户和日期归档。

## 子模块

| 路径 | 仓库 | 作用 |
|------|------|------|
| `wechat-agent-bridge/` | mason0510/wechat-agent-bridge | iLink 协议封装 |
| `agents/simple-agent/` | AuraAIHQ/simple-agent | 我们自己的 agent 仓库 |

更新子模块：

```bash
git submodule update --remote --merge
```

## License

This project is licensed under the [Apache License, Version 2.0](LICENSE).  
Copyright 2024-present MushroomDAO Contributors. See [NOTICE](./NOTICE) for attribution.
