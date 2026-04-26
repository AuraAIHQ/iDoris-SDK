# @agent-wechat/cli

把 WeChat shell 和 `@aura/simple-agent` 的 `StorageAgent` 一行命令串起来。

## 用法

在项目根目录执行：

```bash
# 一次性扫码登录（用专用微信号扫终端二维码）
pnpm wechat:login

# 配置存储路径
cp packages/cli/.env.example packages/cli/.env
$EDITOR packages/cli/.env

# 启动
pnpm wechat:start
```

## 行为

启动后进入长轮询模式：朋友把 bot 的微信号加为好友，发任何东西过来都会按“用户/日期”归档到 `STORAGE_BASE_PATH`，并立即回复确认。

## 替换默认 agent

CLI 默认绑定 `StorageAgent`。如果你想跑别的 agent，最简单的方式是直接改 `main.ts` 中的 `makeAgent()`，或者绕过 CLI 自己写入口：

```ts
import { WeChatInterface } from "@agent-wechat/core";
import { MyAgent } from "./my-agent";

const wechat = new WeChatInterface({ agent: new MyAgent() });
await wechat.login();
await wechat.start();
```
