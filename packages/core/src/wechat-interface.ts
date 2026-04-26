import { login as rawLogin, start as rawStart } from "weixin-agent-sdk";
import type { Agent, LoginOptions, StartOptions } from "weixin-agent-sdk";

export interface WeChatInterfaceOptions {
  /** Agent 实例，处理收到的每条微信消息。 */
  agent: Agent;
}

/**
 * 壳封装层：把 weixin-agent-sdk 的 `login()` / `start(agent, opts)` 函数式 API
 * 包装为面向对象的 `WeChatInterface` 类，便于上层应用持有单一引用。
 */
export class WeChatInterface {
  private readonly agent: Agent;

  constructor(options: WeChatInterfaceOptions) {
    if (!options || !options.agent) {
      throw new TypeError("WeChatInterface: options.agent is required");
    }
    this.agent = options.agent;
  }

  /**
   * 交互式扫码登录。终端打印二维码，等待用户用微信扫码。
   * Token 持久化由下层 SDK 完成（默认写入 `~/.openclaw/`）。
   *
   * @returns 已登录账号的归一化 ID（来自下层 SDK）。
   */
  async login(loginOpts?: LoginOptions): Promise<string> {
    return await rawLogin(loginOpts);
  }

  /**
   * 启动消息长轮询循环；resolve 时表示循环已停止
   * （由 `opts.abortSignal` 触发，或下层发生不可恢复错误）。
   */
  async start(startOpts?: StartOptions): Promise<void> {
    await rawStart(this.agent, startOpts);
  }
}
