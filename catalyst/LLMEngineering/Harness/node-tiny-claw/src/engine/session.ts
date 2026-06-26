// session.ts
import { Message, Role } from '../schema/message.ts';

/**
 * Session 是被隔离的上下文内存空间。
 *
 * 每个 Session 实例维护自己的消息历史队列，并通过唯一的 ID 标识。
 * 不同来源的请求（终端目录哈希、飞书 ChatID、微信 OpenID 等）会分配到不同 Session，
 * 避免无关任务的指令/结果混杂导致大模型"精神分裂"。
 *
 * 设计取舍：Go 原版用 sync.RWMutex 保护 history 的并发读写。
 * Node.js 单线程事件循环下，append/getWorkingMemory 不会被并行打断，理论上不需要锁。
 * 但若后续 Session 跨 Worker 共享（例如 cluster 模式），仍需重新加锁——目前 YAGNI。
 */
export class Session {
  public readonly id: string;
  public readonly workDir: string;
  public readonly createdAt: Date;
  public updatedAt: Date;
  private history: Message[];

  constructor(id: string, workDir: string) {
    this.id = id;
    this.workDir = workDir;
    this.createdAt = new Date();
    this.updatedAt = this.createdAt;
    this.history = [];
  }

  /**
   * 追加消息到 history 末尾，并刷新 updatedAt。
   * 接受可变参数：调用方可以一次追加多条（典型场景：把一次"思考+行动"的成对消息批量塞入）。
   */
  append(...msgs: Message[]): void {
    if (msgs.length === 0) return;
    for (const m of msgs) {
      this.history.push(m);
    }
    this.updatedAt = new Date();
  }

  /**
   * 返回当前 Session 的全量历史（内部引用，调用方请勿直接修改）。
   * 主要用于调试 / 持久化层；正常推理请走 getWorkingMemory。
   */
  snapshot(): readonly Message[] {
    return this.history;
  }

  /**
   * 截取最近 N 条消息作为 Working Memory。
   *
   * 关键正确性：滑动窗口可能把一次"Assistant tool_calls + User tool_result"的成对结构
   * 切到一半。如果只保留了 tool_result（User + tool_call_id）而它对应的 Assistant tool_call
   * 被截掉，OpenAI/MiniMax API 会立刻 400 报错：orphan tool_result。
   *
   * 因此截断后检查 res[0]：如果是 User + tool_call_id（孤儿观察），直接丢掉。
   * 这与 Go 版 getWorkingMemory 行为一致。
   */
  getWorkingMemory(limit: number): Message[] {
    if (limit <= 0 || this.history.length === 0) return [];
    const start = Math.max(0, this.history.length - limit);
    const res = this.history.slice(start);

    // 孤儿 tool_result 兜底
    if (res.length > 0) {
      const first = res[0];
      if (first.role === Role.User && first.tool_call_id) {
        return res.slice(1);
      }
    }
    return res;
  }
}

/**
 * SessionManager：根据 session ID 维护 Session 实例表。
 *
 * 与 Go 版一致：全局单例（globalSessionMgr），但也允许测试时实例化独立的 Manager。
 */
export class SessionManager {
  private sessions: Map<string, Session>;

  constructor() {
    this.sessions = new Map();
  }

  /**
   * 获取或创建指定 ID 的 Session。
   * 已有：直接返回；没有：用 workDir 新建一个。
   * 注意：已存在时 workDir 参数被忽略（沿用旧实例）。
   */
  getOrCreate(id: string, workDir: string): Session {
    const existing = this.sessions.get(id);
    if (existing) return existing;
    const fresh = new Session(id, workDir);
    this.sessions.set(id, fresh);
    return fresh;
  }

  /** 按 ID 取 Session，不存在返回 undefined */
  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /** 当前管理的 Session 总数（测试用） */
  size(): number {
    return this.sessions.size;
  }
}

/**
 * 全局 SessionManager 单例。
 * 与 Go 的 GlobalSessionMgr 对齐：进程级共享，便于上层入口直接 getOrCreate。
 */
export const globalSessionMgr = new SessionManager();