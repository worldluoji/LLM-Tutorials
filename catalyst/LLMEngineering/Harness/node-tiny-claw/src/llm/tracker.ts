// tracker.ts
// CostTracker：LLMProvider 装饰器，在大模型调用前后截获耗时与 Token 用量，
// 按 PricingModel 计算美元成本并累加到 Session，供人类随时查询会话账单。
//
// 设计要点（教程 17. Observability & Evaluation）：
// - 装饰器模式（Decorator）：实现 LLMProvider 接口，对 Main Loop 完全透明。
//   引擎只知道"调 generate 拿回 Message"，并不知道这一层做了耗时采样与计费。
// - 在 Provider 极低层拦截：避免在 10 个调用点复制埋点代码。
// - PricingModel 按 modelName 查表，未命中价格时计费=0（不阻断调用）。
// - 失败路径只打印耗时，不计费（与 Go 版行为一致）。
//
// 与 Go 版的差异：
// - 字段名 totalCostCNY 沿用 Go 命名以保持生态对齐，但数值单位 = USD（与 PricingModel 一致）。
//   这与 Go 版 log 行使用 ¥ 符号是同一历史包袱：教程优先"对齐 Go 行为"而非"修正单位"。
import { LLMProvider } from './llm-provider.ts';
import { Message, ToolDefinition } from '../schema/message.ts';
import { logger } from '../utils/logger.ts';
import { Session } from '../engine/session.ts';

type AbortSignal = globalThis.AbortSignal;

/** 单个模型的价格条目（美元 / 百万 Tokens）。 */
export interface PriceEntry {
  inputPrice: number;
  outputPrice: number;
}

/**
 * 模型计费表：key = model name，value = 单价。
 * 未命中的模型不阻断调用，但 cost 计为 0 并打 warn 提示。
 */
export const PricingModel: Record<string, PriceEntry> = {
  'MiniMax-M3': { inputPrice: 0.15, outputPrice: 0.15 },
};

/**
 * CostTracker 是一个包装了真实 LLMProvider 的装饰器中间件。
 * 通过实现 LLMProvider 接口，它可以被无缝注入到 Main Loop 中，
 * 让引擎在完全无感知的情况下完成耗时采样与成本累加。
 */
export class CostTracker implements LLMProvider {
  constructor(
    private readonly nextProvider: LLMProvider,
    private readonly modelName: string,
    private readonly session?: Session
  ) {}

  async generate(
    messages: Message[],
    availableTools: ToolDefinition[],
    signal?: AbortSignal
  ): Promise<Message> {
    const startTime = Date.now();

    let respMsg: Message;
    try {
      respMsg = await this.nextProvider.generate(messages, availableTools, signal);
    } catch (err) {
      const latency = Date.now() - startTime;
      logger.error(`[Tracker] ❌ API 调用失败，耗时: ${latency}ms`);
      throw err;
    }

    const latency = Date.now() - startTime;

    if (!respMsg.usage) {
      logger.warn(`[Tracker] ⚠️ API 调用完成，但未返回 Usage 数据 | 耗时: ${latency}ms`);
      return respMsg;
    }

    const { prompt_tokens: promptTokens, completion_tokens: completionTokens } = respMsg.usage;

    let cost = 0;
    const price = PricingModel[this.modelName];
    if (price) {
      cost = (promptTokens * price.inputPrice + completionTokens * price.outputPrice) / 1_000_000;
    } else {
      logger.warn(`[Tracker] ⚠️ 模型 ${this.modelName} 不在 PricingModel 中，cost 计为 0`);
    }

    logger.info(
      `[Tracker] 📊 API 调用完成 | 耗时: ${latency}ms | 输入: ${promptTokens} tk | 输出: ${completionTokens} tk | 花费: ¥${cost.toFixed(6)}`
    );

    if (this.session) {
      this.session.recordUsage(promptTokens, completionTokens, cost);
      const snap = this.session.getUsage();
      logger.info(
        `[Tracker] 💰 当前会话 (${this.session.id}) 累计花费: ¥${snap.totalCostCNY.toFixed(6)} | ` +
          `输入: ${snap.promptTokens} tk | 输出: ${snap.completionTokens} tk`
      );
    }

    return respMsg;
  }
}