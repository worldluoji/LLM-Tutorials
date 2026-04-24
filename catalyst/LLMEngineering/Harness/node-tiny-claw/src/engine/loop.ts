// engine.ts
import { LLMProvider } from '../llm/llm-provider.js';
import { Registry } from '../tools/registry.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
import { Message, Role, ToolCall } from '../schema/message.ts';
import { logger } from '../utils/logger.ts';

// Use the global AbortSignal type if available (Node.js >= 15 or browsers)
type AbortSignal = globalThis.AbortSignal;

/**
 * AgentEngine 是微型 OS 的核心驱动
 */
export class AgentEngine {
  private provider: LLMProvider;
  private registry: Registry;
  /** WorkDir (工作区): 借鉴 OpenClaw 的理念，Agent 必须有一个明确的物理边界 */
  public workDir: string;

  constructor(provider: LLMProvider, registry: Registry, workDir: string) {
    this.provider = provider;
    this.registry = registry;
    this.workDir = workDir;
  }

  /**
   * 启动 Agent 的生命周期
   * @param userPrompt - 用户输入的初始提示词
   * @param signal - 可选的取消信号，用于中断整个运行循环
   */
  async run(userPrompt: string, signal?: AbortSignal): Promise<void> {
    logger.info(`引擎启动，锁定工作区: ${this.workDir}`);

    // 1. 初始化会话的 Context (上下文内存)
    // 在真实的场景中，这里会由动态 Prompt 组装器加载 AGENTS.md。目前我们先硬编码。
    const contextHistory: Message[] = [
      {
        role: Role.System,
        content:
          'You are node-tiny-claw, an expert coding assistant. You have full access to tools in the workspace.',
      },
      {
        role: Role.User,
        content: userPrompt,
      },
    ];

    let turnCount = 0;

    // 2. The Main Loop: 心跳开始 (标准的 ReAct 循环)
    while (true) {
      // 支持通过 AbortSignal 中断循环
      if (signal?.aborted) {
        logger.info('收到中断信号，提前退出循环。');
        break;
      }

      turnCount++;
      logger.info(`========== [Turn ${turnCount}] 开始 ==========`);

      // 获取当前挂载的所有工具定义
      const availableTools = this.registry.getAvailableTools();

      // 向大模型发起推理请求 (包含 Reasoning)
      logger.info('正在思考 (Reasoning)...');
      let responseMsg: Message;
      try {
        responseMsg = await this.provider.generate(
          contextHistory,
          availableTools,
          signal
        );
      } catch (error) {
        throw new Error(
          `模型生成失败: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error }
        );
      }

      // 将模型的响应完整追加到上下文历史中
      contextHistory.push(responseMsg);

      // 如果模型回复了纯文本，打印出来 (这通常是它的思考过程，或是最终结果)
      if (responseMsg.content) {
        logger.info(`🤖 模型: ${responseMsg.content}`);
      }

      // 3. 退出条件判断
      // 如果模型没有请求任何工具调用，说明它认为任务已经完成，跳出循环。
      if (!responseMsg.tool_calls || responseMsg.tool_calls.length === 0) {
        logger.info('任务完成，退出循环。');
        break;
      }

      // 4. 执行行动 (Action) 与 获取观察结果 (Observation)
      logger.info(`模型请求调用 ${responseMsg.tool_calls.length} 个工具...`);

      for (const toolCall of responseMsg.tool_calls) {
        logger.info(`  -> 🛠️ 执行工具: ${toolCall.name}, 参数: ${JSON.stringify(toolCall.arguments)}`);

        // 通过 Registry 路由并执行底层工具
        const result = await Promise.resolve(
          this.registry.execute(toolCall, signal)
        );

        if (result.is_error) {
          logger.error(`  -> ❌ 工具执行报错: ${result.output}`);
        } else {
          logger.info(`  -> ✅ 工具执行成功 (返回 ${result.output.length} 字节)`);
        }

        // 将工具执行的观察结果 (Observation) 封装为 User Message 追加到上下文中
        // 注意：ToolCallID 必须携带！这是维系大模型推理链条的关键
        const observationMsg: Message = {
          role: Role.User,
          content: result.output,
          tool_call_id: toolCall.id,
        };
        contextHistory.push(observationMsg);
      }

      // 循环回到开头，模型将带着新加入的 Observation 继续它的下一轮思考...
    }
  }
}