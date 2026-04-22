/* eslint-disable no-unused-vars */
// registry.ts
import { ToolDefinition, ToolCall, ToolResult } from '../schema/message.ts';

// Use the global AbortSignal type if available (Node.js >= 15 or browsers)
type AbortSignal = globalThis.AbortSignal;

/**
 * Registry 定义了工具的注册与分发执行接口
 */
export interface Registry {
  /**
   * 返回当前系统挂载的所有可用工具的 Schema
   */
  getAvailableTools(): ToolDefinition[];

  /**
   * 实际执行模型请求的工具，并返回结果
   * @param call - 模型请求的工具调用信息
   * @param signal - （可选）用于取消长时间运行的工具执行，对应 Go 的 context.Context
   * @returns 工具执行结果（同步或异步，视具体工具而定）
   */
  execute(call: ToolCall, signal?: AbortSignal): Promise<ToolResult> | ToolResult;
}