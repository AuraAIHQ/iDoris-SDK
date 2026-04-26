#!/usr/bin/env node
import "dotenv/config";

import { WeChatInterface } from "@agent-wechat/core";
import { StorageAgent } from "@aura/simple-agent";

const HELP = `wechat-agent — WeChat shell + StorageAgent

用法:
  pnpm wechat:login      扫码登录微信（一次性）
  pnpm wechat:start      启动 bot

环境变量（写在 packages/cli/.env）:
  STORAGE_BASE_PATH      文件存储根目录（默认 ~/.simple-agent/storage）
  STORAGE_SAVE_TEXT      是否记录纯文本消息（true/false，默认 true）
`;

async function runLogin(): Promise<void> {
  const wechat = new WeChatInterface({ agent: makeAgent() });
  await wechat.login();
}

async function runStart(): Promise<void> {
  const ac = new AbortController();
  const stop = () => {
    process.stderr.write("\n收到停止信号，正在退出…\n");
    ac.abort();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const wechat = new WeChatInterface({ agent: makeAgent() });
  await wechat.start({ abortSignal: ac.signal });
}

function makeAgent() {
  const basePath = process.env.STORAGE_BASE_PATH;
  const saveTextEnv = process.env.STORAGE_SAVE_TEXT;
  const saveText =
    saveTextEnv == null ? undefined : !/^(0|false|no|off)$/i.test(saveTextEnv);
  return new StorageAgent({ basePath, saveText });
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  switch (cmd) {
    case "login":
      await runLogin();
      break;
    case "start":
      await runStart();
      break;
    case undefined:
    case "help":
    case "-h":
    case "--help":
      process.stdout.write(HELP);
      break;
    default:
      process.stderr.write(`未知命令：${cmd}\n\n${HELP}`);
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
