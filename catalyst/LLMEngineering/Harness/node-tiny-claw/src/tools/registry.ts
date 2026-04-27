/* eslint-disable no-unused-vars */
// registry.ts
import { ToolDefinition, ToolCall, ToolResult } from '../schema/message.ts';
import { logger } from '../utils/logger.ts';

// Use the global AbortSignal type if available (Node.js >= 15 or browsers)
type AbortSignal = globalThis.AbortSignal;

/**
 * BaseTool 是所有具体工具必须实现的通用抽象类
 */
export abstract class BaseTool {
  /**
   * Name 返回工具的全局唯一名称 (大模型通过这个名字调用它)
   */
  abstract name(): string;

  /**
   * Definition 返回用于提交给大模型的工具元信息和参数 JSON Schema
   */
  abstract definition(): ToolDefinition;

  /**
   * Execute 接收大模型吐出的 JSON 参数，执行具体业务逻辑
   * @param args - JSON 参数（反序列化由各个具体工具内部自行处理）
   * @returns 执行结果字符串或错误
   */
  abstract execute(args: Record<string, unknown> | string): Promise<string>;
}

/**
 * Registry 定义了工具的注册与分发执行接口
 */
export interface Registry {
  /**
   * 挂载一个新的工具到系统中
   */
  register(tool: BaseTool): void;

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

/**
 * RegistryImpl 是 Registry 接口的默认实现
 */
export class RegistryImpl implements Registry {
  private tools: Map<string, BaseTool> = new Map();

  /**
   * register 挂载一个新的工具到系统中
   */
  register(tool: BaseTool): void {
    const name = tool.name();
    if (this.tools.has(name)) {
      logger.warn(`[Registry] 工具 '${name}' 已经被注册，将被覆盖。`);
    }
    this.tools.set(name, tool);
    logger.info(`[Registry] 成功挂载工具: ${name}`);
  }

  /**
   * getAvailableTools 返回当前系统挂载的所有工具的 Schema
   */
  getAvailableTools(): ToolDefinition[] {
    const defs: ToolDefinition[] = [];
    for (const tool of this.tools.values()) {
      defs.push(tool.definition());
    }
    return defs;
  }

  /**
   * execute 实际路由并执行模型请求的工具调用
   */
  async execute(call: ToolCall, _signal?: AbortSignal): Promise<ToolResult> {
    // 1. 路由查找：如果在注册表中找不到该工具，这是模型产生了幻觉
    const tool = this.tools.get(call.name);
    if (!tool) {
      const errMsg = `Error: 系统中不存在名为 '${call.name}' 的工具。`;
      logger.error(`[Registry] ${errMsg}`);
      return {
        tool_call_id: call.id,
        output: errMsg,
        is_error: true,
      };
    }

    // 2. 执行工具逻辑
    let output: string;
    try {
      output = await tool.execute(call.arguments);
    } catch (error) {
      const errMsg = `Error executing ${call.name}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(`[Registry] ${errMsg}`);
      return {
        tool_call_id: call.id,
        output: errMsg,
        is_error: true,
      };
    }

    // 3. 封装结果返回给 Main Loop
    return {
      tool_call_id: call.id,
      output: output,
      is_error: false,
    };
  }
}