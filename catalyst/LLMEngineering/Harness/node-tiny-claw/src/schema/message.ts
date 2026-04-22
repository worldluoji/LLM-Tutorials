/* eslint-disable no-unused-vars */
// message.ts
// 统一的消息与工具调用类型定义

/**
 * Role 定义消息的角色，这是与大模型沟通的基石
 */
export enum Role {
  /** 系统提示词：确立 Agent 的性格与红线 */
  System = "system",
  /** 用户输入 / 工具执行的返回结果 (Observation) */
  User = "user",
  /** 模型的输出：包含推理 (Reasoning) 或工具调用 (ToolCall) */
  Assistant = "assistant",
}

/**
 * Message 代表上下文中传递的单条消息
 */
export interface Message {
  role: Role;
  /** 存放纯文本内容 */
  content: string;
  /** 如果模型决定调用工具，此字段将被填充 (支持并行调用多个工具) */
  tool_calls?: ToolCall[];
  /** 如果这是对某个工具调用的响应，此字段必须填写，以告知模型上下文的关联性 */
  tool_call_id?: string;
}

/**
 * ToolCall 代表模型请求调用某个具体的工具
 */
export interface ToolCall {
  /** 工具调用的唯一 ID */
  id: string;
  /** 想要调用的工具名称 (例如 "bash") */
  name: string;
  /**
   * Arguments 存放 JSON 参数。
   * 在 TypeScript 中保留原始 JSON 对象类型，延迟解析到工具层处理。
   * 实际运行时可能是一个已解析的对象或原始字符串，视具体实现而定。
   */
  arguments: Record<string, unknown> | string;
}

/**
 * ToolResult 代表工具在本地执行完毕后返回的物理结果
 */
export interface ToolResult {
  tool_call_id: string;
  /** 工具执行的控制台输出或报错堆栈 */
  output: string;
  /** 标记是否失败，供后续的驾驭工程进行错误自愈 */
  is_error: boolean;
}

/**
 * ToolDefinition 描述了一个大模型可以调用的工具元信息 (供模型理解工具有什么用)
 */
export interface ToolDefinition {
  name: string;
  description: string;
  /** 对应 JSON Schema 对象，具体结构由工具实现定义 */
  input_schema: Record<string, unknown>;
}