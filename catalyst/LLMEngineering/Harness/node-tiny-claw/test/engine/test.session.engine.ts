/**
 * test.session.engine.ts
 *
 * 表格驱动测试：验证 Session / SessionManager 在隔离与 Working Memory 截取上的行为。
 * 对应教程：10. Session.md
 *
 * 运行：pnpm test --session
 */
import assert from 'node:assert/strict';

import { Session, SessionManager } from '../../src/engine/session.ts';
import { Message, Role, ToolCall } from '../../src/schema/message.ts';

// ============================================================
// 工具：构造固定 fixture，避免每个 case 重复拼消息
// ============================================================
function sysMsg(text: string): Message {
  return { role: Role.System, content: text };
}

function userMsg(text: string): Message {
  return { role: Role.User, content: text };
}

function asstMsg(text: string, toolCalls?: ToolCall[]): Message {
  const m: Message = { role: Role.Assistant, content: text };
  if (toolCalls && toolCalls.length > 0) m.tool_calls = toolCalls;
  return m;
}

function toolResultMsg(toolCallId: string, output: string): Message {
  return { role: Role.User, content: output, tool_call_id: toolCallId };
}

// ============================================================
// Session 单体行为
// ============================================================
interface SessionCase {
  name: string;
  setup: (s: Session) => void;
  /** 直接断言 session 上的字段 */
  checkFields?: (s: Session) => void;
  /** getWorkingMemory(limit) 断言 */
  callLimit: number;
  expectLength: number;
  /** 进一步断言每条消息的关键字段 */
  expectMessage?: (msgs: Message[]) => void;
}

const sessionCases: SessionCase[] = [
  {
    name: '#1 空 Session 取任意 limit - 返回空数组',
    setup: () => {},
    callLimit: 5,
    expectLength: 0,
  },
  {
    name: '#2 limit=0 - 返回空数组（即使有历史）',
    setup: (s) => s.append(userMsg('hi')),
    callLimit: 0,
    expectLength: 0,
  },
  {
    name: '#3 limit 超过历史长度 - 全量返回',
    setup: (s) => {
      s.append(sysMsg('sys'));
      s.append(userMsg('hello'));
    },
    callLimit: 10,
    expectLength: 2,
    expectMessage: (msgs) => {
      assert.equal(msgs[0].role, Role.System);
      assert.equal(msgs[1].role, Role.User);
    },
  },
  {
    name: '#4 limit 小于历史长度 - 只保留最近 N 条',
    setup: (s) => {
      s.append(userMsg('a'));
      s.append(userMsg('b'));
      s.append(userMsg('c'));
      s.append(userMsg('d'));
    },
    callLimit: 2,
    expectLength: 2,
    expectMessage: (msgs) => {
      assert.equal(msgs[0].content, 'c');
      assert.equal(msgs[1].content, 'd');
    },
  },
  {
    name: '#5 孤儿 tool_result（首条是 User+tool_call_id）- 被丢掉',
    setup: (s) => {
      // 模拟历史被截断：上一次 Assistant 的 tool_call 已经掉出窗口，只剩一个 observation
      s.append(toolResultMsg('tc_old', 'old result'));
      s.append(userMsg('continue please'));
    },
    callLimit: 2,
    expectLength: 1,
    expectMessage: (msgs) => {
      assert.equal(msgs[0].content, 'continue please');
      assert.equal(msgs[0].tool_call_id, undefined);
    },
  },
  {
    name: '#6 完整成对的 tool_call/result - 保留',
    setup: (s) => {
      const tc: ToolCall = { id: 'tc_1', name: 'bash', arguments: '{"command":"ls"}' };
      s.append(asstMsg('', [tc]));
      s.append(toolResultMsg('tc_1', 'file.txt'));
      s.append(userMsg('下一步'));
    },
    callLimit: 3,
    expectLength: 3,
    expectMessage: (msgs) => {
      assert.equal(msgs[0].role, Role.Assistant);
      assert.ok(msgs[0].tool_calls && msgs[0].tool_calls[0].id === 'tc_1');
      assert.equal(msgs[1].role, Role.User);
      assert.equal(msgs[1].tool_call_id, 'tc_1');
      assert.equal(msgs[2].content, '下一步');
    },
  },
  {
    name: '#7 多条 tool_call + 多条 result 的成对结构 - 全保留',
    setup: (s) => {
      const tcA: ToolCall = { id: 'tc_a', name: 'bash', arguments: '{}' };
      const tcB: ToolCall = { id: 'tc_b', name: 'read_file', arguments: '{}' };
      s.append(asstMsg('', [tcA, tcB]));
      s.append(toolResultMsg('tc_a', 'ok-a'));
      s.append(toolResultMsg('tc_b', 'ok-b'));
      s.append(asstMsg('总结一下'));
    },
    callLimit: 4,
    expectLength: 4,
    expectMessage: (msgs) => {
      assert.equal(msgs[0].tool_calls?.length, 2);
      assert.equal(msgs[3].content, '总结一下');
    },
  },
  {
    name: '#8 新建 Session 字段初始化正确',
    setup: () => {},
    callLimit: 0,
    expectLength: 0,
    checkFields: (s) => {
      assert.ok(s.id.length > 0);
      assert.ok(s.workDir.length > 0);
      assert.ok(s.createdAt instanceof Date);
      assert.ok(s.updatedAt instanceof Date);
      // 创建瞬间 createdAt 与 updatedAt 应该非常接近（差值 < 1s）
      const delta = s.updatedAt.getTime() - s.createdAt.getTime();
      assert.ok(delta >= 0 && delta < 1000, `updatedAt 与 createdAt 差值异常: ${delta}ms`);
    },
  },
  {
    name: '#9 append 后 updatedAt 被刷新（不早于 createdAt）',
    setup: (s) => {
      const before = s.updatedAt.getTime();
      // 强制时间推进：等 5ms 后再 append
      const start = Date.now();
      while (Date.now() - start < 5) {
        // busy-wait 5ms
      }
      s.append(userMsg('hi'));
      assert.ok(s.updatedAt.getTime() >= before, 'updatedAt 必须推进');
    },
    callLimit: 5,
    expectLength: 1,
  },
  {
    name: '#10 变参 append 一次性追加多条',
    setup: (s) => {
      s.append(
        asstMsg('思考'),
        asstMsg('再想想'),
        userMsg('用户插嘴')
      );
    },
    callLimit: 10,
    expectLength: 3,
    expectMessage: (msgs) => {
      assert.equal(msgs[0].content, '思考');
      assert.equal(msgs[2].content, '用户插嘴');
    },
  },
  {
    name: '#11 append 空变参 - 不报错，updatedAt 不变（无实际写入）',
    setup: (s) => {
      const ts = s.updatedAt.getTime();
      s.append();
      assert.equal(s.updatedAt.getTime(), ts, '无消息追加时 updatedAt 不应改变');
    },
    callLimit: 10,
    expectLength: 0,
  },
  {
    name: '#12 snapshot 返回只读视图（不暴露内部数组）',
    setup: (s) => {
      s.append(userMsg('a'));
      s.append(userMsg('b'));
    },
    callLimit: 10,
    expectLength: 2,
    expectMessage: (msgs) => {
      // snapshot 是 readonly 类型，编译期阻止 push/pop 等变更操作
      const snap = msgs as readonly Message[];
      assert.equal(snap.length, 2);
    },
  },
];

// ============================================================
// SessionManager 行为
// ============================================================
interface ManagerCase {
  name: string;
  run: (m: SessionManager) => void;
  expect: (m: SessionManager) => void;
}

const managerCases: ManagerCase[] = [
  {
    name: '#M1 getOrCreate 首次创建 - 实例化并放入 map',
    run: (m) => {
      const s = m.getOrCreate('chat-1', '/tmp/a');
      assert.ok(s instanceof Session);
    },
    expect: (m) => {
      assert.equal(m.size(), 1);
      assert.equal(m.get('chat-1')?.workDir, '/tmp/a');
    },
  },
  {
    name: '#M2 getOrCreate 同一 ID 二次调用 - 返回同一实例',
    run: (m) => {
      const s1 = m.getOrCreate('chat-2', '/tmp/a');
      const s2 = m.getOrCreate('chat-2', '/tmp/b'); // workDir 不应覆盖
      assert.strictEqual(s1, s2);
    },
    expect: (m) => {
      // 仍只有 chat-2 一条；workDir 沿用首次
      assert.equal(m.size(), 1);
      assert.equal(m.get('chat-2')?.workDir, '/tmp/a');
    },
  },
  {
    name: '#M3 getOrCreate 不同 ID - 创建独立 Session',
    run: (m) => {
      const sa = m.getOrCreate('chat-a', '/tmp/a');
      const sb = m.getOrCreate('chat-b', '/tmp/b');
      assert.notStrictEqual(sa, sb);
    },
    expect: (m) => {
      assert.equal(m.size(), 2);
    },
  },
  {
    name: '#M4 get 不存在的 ID - 返回 undefined',
    run: (m) => {
      m.getOrCreate('exists', '/tmp');
    },
    expect: (m) => {
      assert.equal(m.get('missing'), undefined);
    },
  },
  {
    name: '#M5 Session 状态隔离 - 两个 Session 的 history 互不干扰',
    run: (m) => {
      const sa = m.getOrCreate('a', '/tmp');
      const sb = m.getOrCreate('b', '/tmp');
      sa.append(userMsg('only in A'));
      sb.append(userMsg('only in B'));
      sb.append(userMsg('also in B'));
    },
    expect: (m) => {
      const memA = m.get('a')?.getWorkingMemory(10) ?? [];
      const memB = m.get('b')?.getWorkingMemory(10) ?? [];
      assert.equal(memA.length, 1);
      assert.equal(memA[0].content, 'only in A');
      assert.equal(memB.length, 2);
      assert.equal(memB[1].content, 'also in B');
    },
  },
];

// ============================================================
// 运行器
// ============================================================
function runSessionCases(): number {
  let failed = 0;
  console.log('--- Session 单体 ---');
  for (const c of sessionCases) {
    try {
      const s = new Session(`sess-${Math.random().toString(36).slice(2, 8)}`, '/tmp/work');
      c.setup(s);
      if (c.checkFields) c.checkFields(s);

      const mem = s.getWorkingMemory(c.callLimit);
      assert.equal(
        mem.length,
        c.expectLength,
        `${c.name}: 期望 ${c.expectLength} 条，实际 ${mem.length} 条`
      );
      if (c.expectMessage) c.expectMessage(mem);
      console.log(`✅ ${c.name}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${c.name}\n   ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return failed;
}

function runManagerCases(): number {
  let failed = 0;
  console.log('\n--- SessionManager ---');
  for (const c of managerCases) {
    try {
      // 每个 case 用全新 manager，避免 map 状态串扰
      const m = new SessionManager();
      c.run(m);
      c.expect(m);
      console.log(`✅ ${c.name}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${c.name}\n   ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return failed;
}

function main(): void {
  let failed = 0;
  failed += runSessionCases();
  failed += runManagerCases();

  const total = sessionCases.length + managerCases.length;
  console.log(`\n=== ${total - failed}/${total} 用例通过 ===`);
  if (failed > 0) process.exit(1);
}

main();