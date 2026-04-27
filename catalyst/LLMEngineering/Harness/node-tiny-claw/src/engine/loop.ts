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

  private enableThinking: boolean = true; // 【新增】慢思考模式开关

  constructor(provider: LLMProvider, registry: Registry, workDir: string, enableThinking?: boolean) {
    this.provider = provider;
    this.registry = registry;
    this.workDir = workDir;
    if (enableThinking !== undefined) {
      this.enableThinking = enableThinking;
    }
  }

  /**
   * 启动 Agent 的生命周期
   * @param userPrompt - 用户输入的初始提示词
   * @param signal - 可选的取消信号，用于中断整个运行循环
   */
  async run(userPrompt: string, signal?: AbortSignal): Promise<void> {
    logger.info(`引擎启动，锁定工作区: ${this.workDir}`);
    logger.info(`慢思考模式 (Thinking Phase): ${this.enableThinking}`);

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

    // 2. The Main Loop: 心跳开始 (Two-Stage ReAct 循环)
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

      // ====================================================================
      // Phase 1: 慢思考阶段 (Thinking) - 剥夺工具，强制规划
      // ====================================================================
      if (this.enableThinking) {
        logger.info('[Phase 1] 剥夺工具访问权，强制进入慢思考与规划阶段...');

        // 核心机制：传入的 availableTools 为空数组！
        // 大模型看不到任何工具定义，被迫只能输出纯文本的思考过程。
        try {
          const thinkResp = await this.provider.generate(
            contextHistory,
            [], // 空数组 = 无工具可用
            signal
          );

          // 如果模型输出了思考过程，我们将其作为 Assistant 消息追加到上下文中
          if (thinkResp.content) {
            logger.info(`🧠 [内部思考 Trace]: ${thinkResp.content}`);
            contextHistory.push(thinkResp);
          }
        } catch (error) {
          throw new Error(
            `Thinking 阶段生成失败: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error }
          );
        }
      }

      // ====================================================================
      // Phase 2: 行动阶段 (Action) - 恢复工具，顺着规划执行
      // ====================================================================
      logger.info('[Phase 2] 恢复工具挂载，等待模型采取行动...');

      // 此时的 contextHistory 中已经包含了上一阶段模型自己的 Thinking Trace。
      // 模型会顺着自己的逻辑，结合恢复的 availableTools 发起精准的工具调用。
      let actionResp: Message;
      try {
        actionResp = await this.provider.generate(
          contextHistory,
          availableTools,
          signal
        );
      } catch (error) {
        throw new Error(
          `Action 阶段生成失败: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error }
        );
      }

      contextHistory.push(actionResp);

      if (actionResp.content) {
        logger.info(`🤖 [对外回复]: ${actionResp.content}`);
      }

      // ====================================================================
      // 退出与执行逻辑
      // ====================================================================
      // 如果模型没有请求任何工具调用，说明它认为任务已经完成，跳出循环。
      if (!actionResp.tool_calls || actionResp.tool_calls.length === 0) {
        logger.info('任务完成，退出循环。');
        break;
      }

      logger.info(`模型请求调用 ${actionResp.tool_calls.length} 个工具...`);

      for (const toolCall of actionResp.tool_calls) {
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

        // 将工具执行的观察结果 (Observation) 追加到 Context，准备进入下一轮
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