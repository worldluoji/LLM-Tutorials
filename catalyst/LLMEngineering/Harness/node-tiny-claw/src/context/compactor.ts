// compactor.ts
import { Message, Role } from '../schema/message.ts';
import { logger } from '../utils/logger.ts';

/** 远期历史区：工具返回结果的全量掩码阈值。短结果直接保留，省得无意义换字串。 */
const REMOTE_TOOL_RESULT_MASK_THRESHOLD = 200;

/** 远期历史区：Assistant 推理 trace 的全量掩码阈值。 */
const REMOTE_THINKING_TRACE_MASK_THRESHOLD = 200;

/** 近期保护区：单条消息触发 Head-Tail Truncation 的阈值。 */
const WORKING_MEMORY_TRUNCATE_THRESHOLD = 1000;

/** Head-Tail Truncation 保留的"头/尾"字符数。 */
const HEAD_TAIL_KEEP = 500;

/**
 * Compactor 负责监控和压缩上下文内存，防止大模型发生 OOM。
 *
 * 设计哲学：采用"阶梯降级 (Staged Degradation)"策略——丢弃冗余数据，但死死保住意图和逻辑链。
 * - System Prompt：永远保留，神圣不可侵犯。
 * - 远期历史（超出 Working Memory 保护区的早期对话）：
 *   工具返回值 (Observation) 做全量掩码 (Masking)；
 *   Assistant 冗长推理 trace 也折叠；
 *   但 ToolCall 字段 (id/name/arguments) 绝不修改——那是模型行动意图的证据，
 *   删掉就会出现"孤儿 ToolCall"，让模型陷入原地打转的死循环。
 * - 近期 Working Memory：每条完整保留，但单条超长则执行 Head-Tail Truncation (掐头去尾)。
 *
 * 物理防线 (防 OOM) 的优先级永远高于业务逻辑 (短期记忆完整性)。
 */
export class Compactor {
  /** 触发压缩的最大字符数阈值（水位线，可参考所使用大模型的 token 窗口大小） */
  public readonly maxChars: number;
  /** Working Memory 保护区：最近的 N 条消息 */
  public readonly retainLastMsgs: number;

  constructor(maxChars: number, retainLastMsgs: number) {
    this.maxChars = maxChars;
    this.retainLastMsgs = retainLastMsgs;
  }

  /**
   * 接收准备发送给大模型的消息数组。
   * 如果总长度未超标，直接返回原数组 (大多数情况下的正常路径)；
   * 否则对远期历史区执行全量掩码 (Masking)，对短期保护区执行超长局部截断 (Truncation)。
   *
   * 注意：返回的是新数组，不会原地修改传入的 msgs；
   * 但每条被改写的 Message 是浅拷贝——content 是新字符串，原对象的 tool_calls 引用保持不变。
   */
  compact(msgs: Message[]): Message[] {
    const currentLength = this.estimateLength(msgs);

    // 没有超过水位线，直接返回原数组 (大多数情况下的正常路径)
    if (currentLength < this.maxChars) {
      return msgs;
    }

    logger.warn(
      `⚠️ 内存告警：当前上下文长度 (${currentLength} 字符) 超过阈值 (${this.maxChars})，触发压缩清理...`
    );

    const compacted: Message[] = [];
    const msgCount = msgs.length;

    // 计算受保护的 Working Memory 起始索引
    const protectStartIndex = Math.max(0, msgCount - this.retainLastMsgs);

    for (let i = 0; i < msgCount; i++) {
      const msg = msgs[i];

      // 1. 系统提示词 (System Prompt) 绝对不能动，直接保留
      if (msg.role === Role.System) {
        compacted.push(msg);
        continue;
      }

      // 必须拷贝一份新消息：浅拷贝足够，因为后续只改写 content 字段；
      // tool_calls 引用保持原状——它正是我们不能动的逻辑链证据。
      const newMsg: Message = { ...msg };

      const isInWorkingMemory = i >= protectStartIndex;

      // 【核心驾驭逻辑】: 双重降级防线
      if (msg.role === Role.User && msg.tool_call_id) {
        // 工具的返回结果 (Observation/ToolResult)
        if (!isInWorkingMemory) {
          // 【第一道防线：远期历史】早期对话，执行无情替换 (Full Masking)
          if (msg.content.length > REMOTE_TOOL_RESULT_MASK_THRESHOLD) {
            newMsg.content = `...[为了节省内存，早期的工具输出已被系统强制清理。原始长度: ${msg.content.length} 字节]...`;
          }
        } else {
          // 【第二道防线：短期记忆】即使处于近期保护区，只要单条内容过大，也必须截断防 OOM
          // (Head-Tail Truncation)：保留前 500 字符和后 500 字符（掐头去尾法，
          // 大模型通常只需要看开头报错和结尾总结）
          if (msg.content.length > WORKING_MEMORY_TRUNCATE_THRESHOLD) {
            const head = msg.content.slice(0, HEAD_TAIL_KEEP);
            const tail = msg.content.slice(msg.content.length - HEAD_TAIL_KEEP);
            const dropped = msg.content.length - 2 * HEAD_TAIL_KEEP;
            newMsg.content = `${head}\n\n...[内容过长，中间 ${dropped} 字节已被系统截断]...\n\n${tail}`;
          }
        }
      } else if (msg.role === Role.Assistant && msg.content !== '') {
        // 大模型的冗长推理废话 (Thinking Trace)
        if (!isInWorkingMemory && msg.content.length > REMOTE_THINKING_TRACE_MASK_THRESHOLD) {
          newMsg.content = '...[早期的推理思考过程已折叠]...';
        }
      }

      // 注意：我们绝不会去动 msg.tool_calls，因为这是模型行动的证据，是维系逻辑链的关键！
      compacted.push(newMsg);
    }

    const newLength = this.estimateLength(compacted);
    logger.info(`✅ 压缩完成。上下文长度从 ${currentLength} 降至 ${newLength} 字符。`);

    return compacted;
  }

  /**
   * 粗略计算当前上下文的总字符长度。
   *
   * 工业级精确 token 计算通常需引入复杂的 BPE 词表 (Byte Pair Encoding，
   * 一种把文本切分为子词的分词算法，如 OpenAI 生态里常用的 tiktoken)。
   * 为保持架构极简、降低外部依赖，本项目采用字符数 (char count) 作为内存压力估算指标
   * (经验值：英文 1 token ≈ 4 字符；中文 1 token ≈ 1.5 字符)。
   */
  estimateLength(msgs: Message[]): number {
    let length = 0;
    for (const msg of msgs) {
      length += msg.content.length;
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          length += tc.name.length + this.argumentsLength(tc.arguments);
        }
      }
    }
    return length;
  }

  /**
   * 计算 ToolCall.arguments 的字符长度：
   * - string：直接取 .length，与 Go 版 `len(tc.Arguments)` 语义一致；
   * - object：JSON 序列化后再取 .length（粗略但量级相当，足以用作水位线估算）。
   */
  private argumentsLength(args: Record<string, unknown> | string): number {
    return typeof args === 'string' ? args.length : JSON.stringify(args).length;
  }
}