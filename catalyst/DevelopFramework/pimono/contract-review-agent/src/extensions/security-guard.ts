import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  logToolCall,
  logToolCallResult,
  redactToolResult,
  runSecurityGuards,
} from "../guard/guards.js";

// 安全护栏扩展：拦截危险命令、敏感信息外发、越权文件访问、超额 Token 消耗。
// 由 Pi-mono 的标准发现机制加载（additionalExtensionPaths / extensions 目录）。
export default function securityGuardExtension(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    await logToolCall(event);
    return await runSecurityGuards(event, ctx);
  });

  // ToolResultEventResult 未从主包导出，导致 pi.on 的 "tool_result" 重载在
  // 当前 TypeScript 配置下无法解析，用 cast 让编译器放行。
  (pi as any).on("tool_result", async (event: any, ctx: any) => {
    await logToolCallResult(event);
    return await redactToolResult(event, ctx);
  });
}