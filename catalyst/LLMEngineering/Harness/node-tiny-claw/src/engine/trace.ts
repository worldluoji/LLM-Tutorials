// trace.ts
// 极简版 Trace 引擎：将 Agent 的"思考-行动"周期固化为 JSON 决策树。
// 无第三方依赖；埋点收敛在调用方（loop.ts / tools），本类只负责"开-关-读"。
//
// 设计要点（教程 18. tracing.md）：
// - Span 树用栈管理：startRoot 建根，start 推子 span，end 弹栈并冻结。
// - 时间用 performance.now()（单调时钟，跨 await 准确），序列化时用 Date 转 ISO8601
//   带时区偏移（与 Go time.Now().Format(time.RFC3339Nano) 视觉一致）。
// - 禁用时所有方法 no-op（enabled=false 路径），report() 返回 null —— 零运行时开销。
// - 默认构造实例（与 compactor/recovery/reminder 风格一致），测试可注入 mock。

/**
 * Span 是 Trace 树上的一个节点，对应一次"思考-行动"原子单元。
 * children 仅在 end() 之后填充（栈弹出时把当前 span 的所有已完成子 span 冻结进来）。
 */
export interface Span {
  name: string;
  /** ISO8601 带时区偏移，例如 2026-05-01T18:01:12.848073+08:00 */
  start_time: string;
  end_time: string;
  duration_ms: number;
  attributes?: Record<string, unknown>;
  children?: Span[];
}

/**
 * 内部可变 Span：埋点阶段可能通过 setAttribute 追加字段；end() 时再冻结为 Span。
 */
interface MutableSpan {
  name: string;
  startMs: number;
  endMs?: number;
  startDate: Date;
  endDate?: Date;
  attributes: Record<string, unknown>;
  children: MutableSpan[];
}

/**
 * Tracer 是 Trace 引擎的对外接口。
 *
 * 用法（与 defer 风格类似）：
 *   const tracer = new Tracer(true);
 *   tracer.startRoot('Agent.Run', { SessionID: 'xxx' });
 *   tracer.start('Turn-1');
 *   tracer.start('LLM.Action');
 *   // ... 发起大模型调用 ...
 *   tracer.end();
 *   tracer.end();
 *   console.log(JSON.stringify(tracer.report(), null, 2));
 */
export class Tracer {
  private enabled: boolean;
  private root: MutableSpan | null = null;
  /** 当前未关闭的 span 栈；栈顶 = 当前正在埋点的 span */
  private stack: MutableSpan[] = [];

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  /** 开启/关闭 trace（运行时切换，已写入的树保留）。 */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 启动根 span。必须作为第一次调用；若 root 已存在则 no-op（避免重复初始化）。
   * 启动后 root 同时入栈，后续 start/end 在其下嵌套。
   */
  startRoot(name: string, attributes?: Record<string, unknown>): void {
    if (!this.enabled) return;
    if (this.root !== null) return; // 重复 startRoot 静默忽略
    const now = performance.now();
    const span: MutableSpan = {
      name,
      startMs: now,
      startDate: new Date(),
      attributes: attributes ? { ...attributes } : {},
      children: [],
    };
    this.root = span;
    this.stack.push(span);
  }

  /**
   * 启动一个子 span，挂到当前栈顶 span 下；新 span 同时入栈成为新的栈顶。
   * 若未启用或栈为空则 no-op。
   */
  start(name: string, attributes?: Record<string, unknown>): void {
    if (!this.enabled) return;
    if (this.stack.length === 0) return;
    const now = performance.now();
    const span: MutableSpan = {
      name,
      startMs: now,
      startDate: new Date(),
      attributes: attributes ? { ...attributes } : {},
      children: [],
    };
    const parent = this.stack[this.stack.length - 1];
    parent.children.push(span);
    this.stack.push(span);
  }

  /**
   * 结束当前栈顶 span：冻结起止时间与耗时，并从栈中弹出。
   * 若栈为空则 no-op（容错：end 比 start 多时静默忽略）。
   */
  end(): void {
    if (!this.enabled) return;
    if (this.stack.length === 0) return;
    const now = performance.now();
    const span = this.stack.pop()!;
    span.endMs = now;
    span.endDate = new Date();
  }

  /**
   * 给当前栈顶 span 追加 attribute。
   * 用于"span 已启动但又收集到了额外信息"的场景（例如工具执行结果回来后追加 output_preview）。
   */
  setAttribute(key: string, value: unknown): void {
    if (!this.enabled) return;
    if (this.stack.length === 0) return;
    const span = this.stack[this.stack.length - 1];
    span.attributes[key] = value;
  }

  /**
   * 序列化根 span 为 Span 树。禁用或无 root 时返回 null。
   */
  report(): Span | null {
    if (!this.enabled || this.root === null) return null;
    return freezeSpan(this.root);
  }

  /**
   * 直接追加一个完整 span 到当前栈顶 span 的 children 列表，不动栈。
   *
   * 用途：并行场景下多个工具 span 同时挂载，不能用 start/end（栈式 end 会 LIFO 误关）。
   * 调用方需自行捕获 start/end 时间戳（用 performance.now() + new Date()），并冻结成
   * 完整的 Span 结构后通过此方法注入。
   *
   * 约束：栈必须非空（即当前有父 span）。栈空时静默忽略。
   */
  addSpan(name: string, startMs: number, endMs: number, startDate: Date, endDate: Date, attributes?: Record<string, unknown>): void {
    if (!this.enabled) return;
    if (this.stack.length === 0) return;
    const parent = this.stack[this.stack.length - 1];
    const span: MutableSpan = {
      name,
      startMs,
      endMs,
      startDate,
      endDate,
      attributes: attributes ? { ...attributes } : {},
      children: [],
    };
    parent.children.push(span);
  }
}

/**
 * 把内部 MutableSpan 冻结为对外的 Span（不可变 + 类型干净）。
 * 递归处理 children；attributes 仅在非空时序列化（避免 {}.attributes 这种噪音）。
 */
function freezeSpan(s: MutableSpan): Span {
  const result: Span = {
    name: s.name,
    start_time: formatISOWithOffset(s.startDate),
    end_time: formatISOWithOffset(s.endDate ?? s.startDate),
    duration_ms: Math.round((s.endMs ?? s.startMs) - s.startMs),
  };
  if (Object.keys(s.attributes).length > 0) {
    result.attributes = { ...s.attributes };
  }
  if (s.children.length > 0) {
    result.children = s.children.map(freezeSpan);
  }
  return result;
}

/**
 * 把 Date 格式化为 ISO8601 带时区偏移的字符串（与 Go RFC3339Nano 视觉一致）。
 *
 * 例：new Date('2026-05-01T18:01:12.848+08:00') → "2026-05-01T18:01:12.848+08:00"
 *
 * 实现说明：JS Date 没有原生 "带 offset 的 ISO" 输出，
 * toISOString 固定返回 UTC 的 Z 后缀；这里手动拼装 local time + offset。
 */
function formatISOWithOffset(d: Date): string {
  const pad2 = (n: number): string => String(n).padStart(2, '0');
  const pad3 = (n: number): string => String(n).padStart(3, '0');
  const pad6 = (n: number): string => String(n).padStart(6, '0');

  // getTimezoneOffset 返回"本地 - UTC"的分钟差，东八区返回 -480
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const offsetStr = `${sign}${pad2(Math.floor(absMin / 60))}:${pad2(absMin % 60)}`;

  const ms = d.getMilliseconds();
  const msStr = ms < 1 ? '000' : pad6(ms);

  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` +
    `.${msStr}${offsetStr}`
  );
}