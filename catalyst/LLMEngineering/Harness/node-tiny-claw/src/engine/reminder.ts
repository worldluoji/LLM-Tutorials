// reminder.ts
import { createHash } from 'node:crypto';
import { Message, Role } from '../schema/message.ts';

/**
 * 触发死循环干预的连续失败阈值。
 * 同一工具 + 同一参数指纹累计失败 >= 3 次时，强行注入打断指令。
 * 阈值参考 Go 版 NewReminderInjector 的设计；可通过 checkAndInject
 * 调用方在 fingerprint 维度独立计数，互不干扰。
 */
const DOOM_LOOP_THRESHOLD = 3;

/**
 * ToolResult 的最小子集：ReminderInjector 不依赖完整 ToolResult 类型，
 * 只需要知道 is_error 和 output（供未来扩展"按错误内容调整措辞"用）。
 */
export interface ReminderToolResult {
  tool_call_id: string;
  output: string;
  is_error: boolean;
}

/**
 * ReminderInjector 在运行时监控上下文，当大模型在同一个工具 + 参数组合上
 * 连续失败达到阈值时，动态注入一条"打断执念"的 System Reminder。
 *
 * 设计原理（教程 14. Doom Loop.md）：
 * - 大模型存在近因偏差（Recency Bias），对上下文末尾信息权重最高
 * - 因此 Reminder 必须以 RoleUser 身份注入到上下文最末端
 * - 注入时机：每次工具执行失败后立即调用 checkAndInject，
 *   若返回非 null Message，由调用方在所有 observations push 之后追加到 Session
 *
 * 状态语义：
 * - 成功执行任意工具 → 清空所有失败计数器（路径走通，旧执念应被打断）
 * - 失败执行 → 该指纹失败次数 +1，跨多次 AgentEngine.run 持续累加
 *   （一个 Session 的连续 retry 应当被追踪，与 Go 版本行为一致）
 */
export class ReminderInjector {
  /** toolName + arguments 指纹 → 连续失败次数 */
  private readonly consecutiveFailures: Map<string, number>;

  constructor() {
    this.consecutiveFailures = new Map();
  }

  /**
   * 分析本轮工具执行结果：
   * - 成功：清空所有失败计数器，返回 null
   * - 失败：累加该指纹计数；若达到阈值，返回一条 RoleUser 的打断指令；
   *         否则返回 null
   */
  checkAndInject(lastToolCall: { name: string; arguments: unknown }, lastResult: ReminderToolResult): Message | null {
    const fingerprint = generateFingerprint(lastToolCall.name, lastToolCall.arguments);

    // 成功：清空所有失败计数器（Agent 在某条路径走通了，旧执念应被冲销）
    if (!lastResult.is_error) {
      this.consecutiveFailures.clear();
      return null;
    }

    // 失败：累加该指纹的失败次数
    const prev = this.consecutiveFailures.get(fingerprint) ?? 0;
    const failCount = prev + 1;
    this.consecutiveFailures.set(fingerprint, failCount);

    if (failCount < DOOM_LOOP_THRESHOLD) {
      return null;
    }

    // 触发死循环干预：构造一条极其严厉、跳出局部思维的行动指南
    return {
      role: Role.User,
      content:
        `[SYSTEM REMINDER 警告]\n` +
        `你似乎陷入了死循环。你刚刚连续 ${failCount} 次使用相同的参数调用了 '${lastToolCall.name}' 工具，并且都失败了。\n` +
        `请立即停止这种无效的重试！你的注意力被当前的报错过度吸引了。\n` +
        `你需要：\n` +
        `1. 停止猜测参数。跳出当前的局部思维。\n` +
        `2. 彻底改变你的策略。\n` +
        `3. 如果你确实无法通过系统工具解决当前问题，请直接结束任务并向用户说明你需要什么人工帮助，而不是继续盲目消耗 API 资源尝试。`,
    };
  }

  /**
   * 暴露当前失败计数快照，主要供测试断言状态；生产代码不应依赖。
   */
  getFailureCount(toolName: string, args: unknown): number {
    const fp = generateFingerprint(toolName, args);
    return this.consecutiveFailures.get(fp) ?? 0;
  }
}

/**
 * 生成工具调用的唯一指纹：MD5(toolName + serializedArgs)。
 *
 * 与 Go 版 `generateFingerprint` 语义一致：相同 (name, args) 必须产生相同指纹，
 * 不同 (name, args) 必须产生不同指纹（哈希碰撞概率可忽略）。
 *
 * args 归一化策略：
 * - string：直接拼接到 hash；
 * - Record：JSON.stringify 后拼接。键序在不同调用间应保持稳定，
 *   否则相同语义的参数会算出不同指纹——调用方需保证传入的对象键序一致。
 */
function generateFingerprint(toolName: string, args: unknown): string {
  const argsStr = typeof args === 'string' ? args : JSON.stringify(args);
  return createHash('md5').update(toolName).update(argsStr).digest('hex');
}