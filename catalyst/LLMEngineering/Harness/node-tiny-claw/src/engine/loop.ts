// engine.ts
import { LLMProvider } from '../llm/llm-provider.js';
import { Registry } from '../tools/registry.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
import { Message, Role, ToolCall } from '../schema/message.ts';
import { logger } from '../utils/logger.ts';
import { PromptComposer } from '../context/composer.ts';
import { Reporter } from './terminal_reporter.ts';

// Use the global AbortSignal type if available (Node.js >= 15 or browsers)
type AbortSignal = globalThis.AbortSignal;

/** Main Loop 最大轮数：超出后强制退出，避免模型死循环把任务跑到分钟级 */
const MAX_TURNS = 50;

/**
 * AgentEngine 是微型 OS 的核心驱动
 */
export class AgentEngine {
  private provider: LLMProvider;
  private registry: Registry;
  /** WorkDir (工作区): 借鉴 OpenClaw 的理念，Agent 必须有一个明确的物理边界 */
  public workDir: string;
  /** PromptComposer 负责按 Core → AGENTS.md → Skills 顺序动态生成 System Prompt */
  private composer: PromptComposer;

  private enableThinking: boolean = true; // 【新增】慢思考模式开关

  constructor(provider: LLMProvider, registry: Registry, workDir: string, enableThinking?: boolean) {
    this.provider = provider;
    this.registry = registry;
    this.workDir = workDir;
    this.composer = new PromptComposer(workDir);
    if (enableThinking !== undefined) {
      this.enableThinking = enableThinking;
    }
  }

  /**
   * 启动 Agent 的生命周期
   * @param userPrompt - 用户输入的初始提示词
   * @param signal - 可选的取消信号，用于中断整个运行循环
   * @param reporter - 把 Agent 状态反馈给用户的渠道；缺省时静默 no-op（保持向后兼容）
   */
  async run(userPrompt: string, signal?: AbortSignal, reporter?: Reporter): Promise<void> {
    /** 静默 no-op reporter：保证 reporter 缺省时也不会 NPE */
    const r: Reporter = reporter ?? {
      onThinking: () => {},
      onToolCall: () => {},
      onToolResult: () => {},
      onMessage: () => {},
    };

    logger.info(`引擎启动，锁定工作区: ${this.workDir}`);
    logger.info(`慢思考模式 (Thinking Phase): ${this.enableThinking}`);

    // 1. 初始化会话的 Context (上下文内存)
    // System Prompt 由 PromptComposer 动态组装：极简内核 + AGENTS.md + Skills
    logger.info('[System Prompt] 由 PromptComposer 组装中...');
    const systemMessage = await this.composer.build();
    logger.info(`[System Prompt] 组装完成 (${systemMessage.content.length} 字节)`);

    const contextHistory: Message[] = [
      systemMessage,
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

      // 轮数熔断：超过 MAX_TURNS 强制退出，输出空 reply 让 reporter 渲染结束语
      if (turnCount > MAX_TURNS) {
        logger.warn(`已达到最大轮数 ${MAX_TURNS}，强制退出循环`);
        r.onMessage(`已达最大轮数 ${MAX_TURNS}，任务未完成。`);
        break;
      }

      // 获取当前挂载的所有工具定义
      const availableTools = this.registry.getAvailableTools();

      // ====================================================================
      // Phase 1: 慢思考阶段 (Thinking) - 剥夺工具，强制规划
      // ====================================================================
      if (this.enableThinking) {
        logger.info('[Phase 1] 剥夺工具访问权，强制进入慢思考与规划阶段...');
        r.onThinking();

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
          }
          // Phase 1 是纯思考阶段，绝不向 context 写入 tool_calls。
          // 模型在无工具可用时会用文本格式"伪调用"（例如 <tool_call>...</tool_call>），
          // provider 的兜底解析会把它们转成结构化 tool_calls，但这些调用从未被实际执行。
          // 若保留 tool_calls，下一轮模型回看会以为已发起过任务，放弃重发。
          // 清空 tool_calls 字段，但保留 content（叙述式思考对下轮仍有价值）。
          delete thinkResp.tool_calls;
          contextHistory.push(thinkResp);
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
        // 把模型的"最终对外回复"经由 reporter 渲染给用户
        r.onMessage(actionResp.content);
        break;
      }

      logger.info(`模型请求调用 ${actionResp.tool_calls.length} 个工具（并行 Fork-Join）...`);

      // Fork: 一次性把所有工具调用挂到事件循环上并发推进。
      // 上一章的"独立性假设"在此兑现 —— 同一 Turn 内的 tool_calls 视为互相独立，无脑并行。
      const settled = await Promise.allSettled(
        actionResp.tool_calls.map((tc) => {
          logger.info(`  -> 🛠️ 派发: ${tc.name}, 参数: ${JSON.stringify(tc.arguments)}`);
          // 派发前先通知 reporter；参数序列化为字符串供展示
          r.onToolCall(tc.name, JSON.stringify(tc.arguments));
          return this.registry.execute(tc, signal);
        })
      );

      // Join: 按原索引回填 observation。
      // - Promise.allSettled 的结果数组与输入数组索引严格对齐，与"哪个先完成"无关。
      // - 按 tool_calls 原序 push，保证 contextHistory 中 tool_call_id 顺序与模型期望一致。
      // - 使用 allSettled 而非 all：失败原样回传给模型，由其在下一轮自纠错（YOLO 哲学）。
      for (let i = 0; i < actionResp.tool_calls.length; i++) {
        const toolCall = actionResp.tool_calls[i];
        const s = settled[i];

        let output: string;
        let isError: boolean;
        if (s.status === 'fulfilled') {
          output = s.value.output;
          isError = s.value.is_error;
        } else {
          // registry.execute 自身 reject（罕见：通常工具异常已被 RegistryImpl 包装为 is_error:true）
          output = `Tool execution rejected: ${s.reason instanceof Error ? s.reason.message : String(s.reason)}`;
          isError = true;
        }

        if (isError) {
          logger.error(`  -> ❌ [${toolCall.name}] 报错: ${output}`);
        } else {
          logger.info(`  -> ✅ [${toolCall.name}] 成功 (返回 ${output.length} 字节)`);
        }
        // 把工具执行结果（成功或失败）渲染给用户
        r.onToolResult(toolCall.name, output, isError);

        const observationMsg: Message = {
          role: Role.User,
          content: output,
          tool_call_id: toolCall.id,
        };
        contextHistory.push(observationMsg);
      }

      // 循环回到开头，模型将带着新加入的 Observation 继续它的下一轮思考...
    }
  }
}