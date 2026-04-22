/* eslint-disable no-unused-vars */
// provider.ts
import { Message, ToolDefinition } from '../schema/message.ts';

// If using Node.js < 15, uncomment the following line and install 'abort-controller':
// import { AbortSignal } from 'abort-controller';

// Use the global AbortSignal type if available (Node.js >= 15 or browsers)
type AbortSignal = globalThis.AbortSignal;

/**
 * LLMProvider 定义了与大模型通信的统一契约
 */
export interface LLMProvider {
  /**
   * Generate 接收当前的上下文历史、可用工具列表，并发起一次大模型推理
   * @param messages - 当前对话上下文历史
   * @param availableTools - 可供模型调用的工具列表
   * @param signal - （可选）用于取消请求的 AbortSignal，相当于 Go 的 context.Context 取消机制
   * @returns 模型返回的新消息（可能包含文本内容或工具调用请求）
   */
  generate(
    messages: Message[],
    availableTools: ToolDefinition[],
    signal?: AbortSignal
  ): Promise<Message>;
}