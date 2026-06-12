/**
 * test.parallel-dispatch.engine.ts
 *
 * 表格驱动测试：验证 AgentEngine 在同一 Turn 内对多个 tool_calls 使用
 * Promise.allSettled 进行 Fork-Join 并行分发。
 *
 * 对应教程：8. Parallel Tool Calling.md
 *
 * 运行：pnpm test --parallel-dispatch
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { AgentEngine } from '../../src/engine/loop.ts';
import {
  Message,
  Role,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from '../../src/schema/message.ts';
import { LLMProvider } from '../../src/llm/llm-provider.ts';
import { Registry, BaseTool } from '../../src/tools/registry.ts';

// ============================================================
// MockRegistry: 按预设的延迟/模式回应每个 tool_call
// ============================================================
type CallSpec =
  | { mode: 'resolve'; delayMs: number; output: string }
  | { mode: 'errorResult'; delayMs: number; errMsg: string }
  | { mode: 'reject'; delayMs: number; errMsg: string };

class MockRegistry implements Registry {
  constructor(private specs: Map<string, CallSpec>) {}

  register(_tool: BaseTool): void {
    // no-op
  }

  getAvailableTools(): ToolDefinition[] {
    return [
      {
        name: 'fake',
        description: 'fake tool',
        input_schema: { type: 'object', properties: {}, required: [] },
      },
    ];
  }

  async execute(call: ToolCall, _signal?: AbortSignal): Promise<ToolResult> {
    const spec = this.specs.get(call.id);
    if (!spec) {
      throw new Error(`MockRegistry: 未为 tool_call_id="${call.id}" 配置 spec`);
    }
    await new Promise((r) => setTimeout(r, spec.delayMs));
    if (spec.mode === 'reject') {
      throw new Error(spec.errMsg);
    }
    if (spec.mode === 'errorResult') {
      return { tool_call_id: call.id, output: spec.errMsg, is_error: true };
    }
    return { tool_call_id: call.id, output: spec.output, is_error: false };
  }
}

// ============================================================
// MockProvider: 第 1 次 generate 吐出 tool_calls，第 2 次结束循环
// 同时在第 2 次调用时快照 contextHistory，供测试断言 observation 顺序
// ============================================================
class MockProvider implements LLMProvider {
  callCount = 0;
  /** 第二次 generate 时引擎传入的 contextHistory 快照（即所有 observation 已 push 进去后的状态） */
  capturedHistory: Message[] = [];

  constructor(private toolCalls: ToolCall[]) {}

  async generate(
    msgs: Message[],
    _tools: ToolDefinition[],
    _signal?: AbortSignal
  ): Promise<Message> {
    this.callCount++;
    if (this.callCount === 1) {
      // Phase 2 行动：一次返回多个 tool_calls
      return {
        role: Role.Assistant,
        content: '',
        tool_calls: this.toolCalls,
      } as Message;
    }
    // 第二次调用：快照（此时所有 observation 已 push）并结束循环
    this.capturedHistory = [...msgs];
    return { role: Role.Assistant, content: 'done' } as Message;
  }
}

// ============================================================
// 用例表
// ============================================================
interface TestCase {
  name: string;
  toolCalls: ToolCall[];
  specs: Map<string, CallSpec>;
  /** 引擎完整运行（不应抛）后断言；若 expectThrow 为 true 则只断言抛出 */
  expectThrow?: boolean;
  verify?: (ctx: { provider: MockProvider; elapsedMs: number }) => void;
}

const mkCall = (id: string, name = 'fake'): ToolCall => ({
  id,
  name,
  arguments: {},
});

const cases: TestCase[] = [
  // ---------- 用例 1：单工具，验证不退化 ----------
  {
    name: '#1 单工具：50ms 成功，总耗时 ~50ms，仅 1 条 observation',
    toolCalls: [mkCall('A')],
    specs: new Map<string, CallSpec>([
      ['A', { mode: 'resolve', delayMs: 50, output: 'okA' }],
    ]),
    verify: ({ provider, elapsedMs }) => {
      assert.ok(elapsedMs < 200, `期望 <200ms，实测 ${elapsedMs.toFixed(1)}ms`);
      const observations = provider.capturedHistory.filter(
        (m) => m.tool_call_id !== undefined
      );
      assert.equal(observations.length, 1);
      assert.equal(observations[0].tool_call_id, 'A');
      assert.equal(observations[0].content, 'okA');
    },
  },

  // ---------- 用例 2：三独立工具并行，总耗时 << 串行 ----------
  {
    name: '#2 三独立工具(100ms each)：总耗时应远小于 300ms 串行 → <200ms',
    toolCalls: [mkCall('A'), mkCall('B'), mkCall('C')],
    specs: new Map<string, CallSpec>([
      ['A', { mode: 'resolve', delayMs: 100, output: 'okA' }],
      ['B', { mode: 'resolve', delayMs: 100, output: 'okB' }],
      ['C', { mode: 'resolve', delayMs: 100, output: 'okC' }],
    ]),
    verify: ({ provider, elapsedMs }) => {
      // 并行约 100-130ms；串行约 300ms+。门槛 200ms 给硬件波动留余地。
      assert.ok(
        elapsedMs < 200,
        `期望 <200ms（并行硬证据），实测 ${elapsedMs.toFixed(1)}ms —— 看起来仍在串行执行`
      );
      const observations = provider.capturedHistory.filter(
        (m) => m.tool_call_id !== undefined
      );
      assert.equal(observations.length, 3);
    },
  },

  // ---------- 用例 3：一条 is_error，两条成功（兄弟不被打断） ----------
  {
    name: '#3 一失败(is_error)两成功：3 条 observation 全进 history，B 标错',
    toolCalls: [mkCall('A'), mkCall('B'), mkCall('C')],
    specs: new Map<string, CallSpec>([
      ['A', { mode: 'resolve', delayMs: 30, output: 'okA' }],
      ['B', { mode: 'errorResult', delayMs: 30, errMsg: 'B failed gracefully' }],
      ['C', { mode: 'resolve', delayMs: 30, output: 'okC' }],
    ]),
    verify: ({ provider }) => {
      const observations = provider.capturedHistory.filter(
        (m) => m.tool_call_id !== undefined
      );
      assert.equal(observations.length, 3, '三条 observation 都应进入 history');
      const byId = new Map(observations.map((o) => [o.tool_call_id, o.content]));
      assert.equal(byId.get('A'), 'okA');
      assert.equal(byId.get('B'), 'B failed gracefully');
      assert.equal(byId.get('C'), 'okC');
    },
  },

  // ---------- 用例 4：全 reject（覆盖 allSettled 的 rejected 分支） ----------
  {
    name: '#4 全部 reject：引擎不应崩溃；两条错误 observation 全进 history',
    toolCalls: [mkCall('A'), mkCall('B')],
    specs: new Map<string, CallSpec>([
      ['A', { mode: 'reject', delayMs: 20, errMsg: 'boom-A' }],
      ['B', { mode: 'reject', delayMs: 20, errMsg: 'boom-B' }],
    ]),
    verify: ({ provider }) => {
      const observations = provider.capturedHistory.filter(
        (m) => m.tool_call_id !== undefined
      );
      assert.equal(observations.length, 2, '即使全部 reject，两条 observation 也应入栈');
      const byId = new Map(observations.map((o) => [o.tool_call_id, o.content]));
      assert.match(byId.get('A') ?? '', /boom-A/);
      assert.match(byId.get('B') ?? '', /boom-B/);
    },
  },

  // ---------- 用例 5：完成顺序乱序，但 observation 仍按 tool_calls 原序 ----------
  {
    name: '#5 顺序保留：A(200ms) B(50ms) C(100ms) 即便 B 最快完成，observation 顺序仍为 [A,B,C]',
    toolCalls: [mkCall('A'), mkCall('B'), mkCall('C')],
    specs: new Map<string, CallSpec>([
      ['A', { mode: 'resolve', delayMs: 200, output: 'okA' }],
      ['B', { mode: 'resolve', delayMs: 50, output: 'okB' }],
      ['C', { mode: 'resolve', delayMs: 100, output: 'okC' }],
    ]),
    verify: ({ provider, elapsedMs }) => {
      assert.ok(
        elapsedMs < 350,
        `并行下应接近 200ms（≈max），实测 ${elapsedMs.toFixed(1)}ms`
      );
      const observations = provider.capturedHistory.filter(
        (m) => m.tool_call_id !== undefined
      );
      assert.deepEqual(
        observations.map((o) => o.tool_call_id),
        ['A', 'B', 'C'],
        'observation 顺序必须严格匹配 tool_calls 原序（按索引回填）'
      );
    },
  },
];

// ============================================================
// 运行器
// ============================================================
async function runCase(c: TestCase): Promise<void> {
  const provider = new MockProvider(c.toolCalls);
  const registry = new MockRegistry(c.specs);
  const engine = new AgentEngine(provider, registry, process.cwd(), false); // 关闭 thinking 简化

  const t0 = performance.now();
  let thrown: unknown = null;
  try {
    await engine.run(`run case: ${c.name}`);
  } catch (e) {
    thrown = e;
  }
  const elapsedMs = performance.now() - t0;

  if (c.expectThrow) {
    assert.ok(thrown, '期望 engine.run 抛出，实际未抛');
    return;
  }
  if (thrown) {
    throw new Error(
      `引擎崩溃（不应崩）: ${thrown instanceof Error ? thrown.message : String(thrown)}`
    );
  }
  c.verify?.({ provider, elapsedMs });
}

async function main(): Promise<void> {
  let failed = 0;
  for (const c of cases) {
    try {
      await runCase(c);
      console.log(`✅ ${c.name}`);
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`❌ ${c.name}\n   ${msg}`);
    }
  }
  console.log(`\n=== ${cases.length - failed}/${cases.length} 用例通过 ===`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('测试运行器自身崩溃:', e);
  process.exit(1);
});
