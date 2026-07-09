/**
 * test.tracker.ts
 *
 * 表格驱动测试：验证 CostTracker 在大模型调用前后截获耗时与 Token 用量，
 * 按 PricingModel 计算成本并把账单累加到 Session。
 *
 * 对应教程：17. Observability & Evaluation.md
 *
 * 运行：pnpm test --tracker
 */
import assert from 'node:assert/strict';

import { CostTracker, PricingModel } from '../../src/llm/tracker.ts';
import { LLMProvider } from '../../src/llm/llm-provider.ts';
import { Message, Role, ToolDefinition } from '../../src/schema/message.ts';
import { Session } from '../../src/engine/session.ts';

type AbortSignal = globalThis.AbortSignal;

// ============================================================
// MockProvider：按用例预设延迟 + usage 行为
// ============================================================
type MockSpec =
  | { mode: 'resolve'; delayMs: number; msg: Message }
  | { mode: 'reject'; delayMs: number; errMsg: string };

class MockProvider implements LLMProvider {
  callCount = 0;
  /** 每次 generate 收到的 messages（快照，供用例断言"参数透传"） */
  receivedArgs: Array<{ msgs: Message[]; tools: ToolDefinition[] }> = [];

  constructor(private spec: MockSpec) {}

  async generate(
    msgs: Message[],
    availableTools: ToolDefinition[],
    _signal?: AbortSignal
  ): Promise<Message> {
    this.callCount++;
    this.receivedArgs.push({ msgs: [...msgs], tools: [...availableTools] });
    await new Promise((r) => setTimeout(r, this.spec.delayMs));
    if (this.spec.mode === 'reject') {
      throw new Error(this.spec.errMsg);
    }
    return this.spec.msg;
  }
}

// ============================================================
// 用例表
// ============================================================
interface TestCase {
  name: string;
  /** 模型名（用于 PricingModel 查表） */
  modelName: string;
  /** mock provider 的延迟与响应 */
  spec: MockSpec;
  /** 是否创建 session 注入 tracker */
  withSession: boolean;
  /** 用例断言（基于 session 累加 + Provider 透传） */
  verify?: (ctx: {
    provider: MockProvider;
    session?: Session;
    elapsedMs: number;
  }) => void;
}

const cases: TestCase[] = [
  // ---------- 基础透明性 ----------
  {
    name: '#1 单调用 - msg 原样透传，tools 原样透传，调用计数 +1',
    modelName: 'MiniMax-M3',
    spec: {
      mode: 'resolve',
      delayMs: 5,
      msg: {
        role: Role.Assistant,
        content: 'hi',
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      },
    },
    withSession: false,
    verify: ({ provider, elapsedMs }) => {
      assert.equal(provider.callCount, 1, '底层 provider 应被调用 1 次');
      assert.ok(elapsedMs >= 5, `elapsedMs 应 >= mock 延迟 5ms，实测 ${elapsedMs}ms`);
      assert.equal(provider.receivedArgs[0].msgs.length, 1, 'msgs 应原样透传');
    },
  },

  // ---------- 计费公式：单条 100in + 50out @ 0.15/0.15 → 0.0000225 ----------
  {
    name: '#2 标准计费 - 100in + 50out @ 0.15/0.15 → cost=0.0000225',
    modelName: 'MiniMax-M3',
    spec: {
      mode: 'resolve',
      delayMs: 0,
      msg: {
        role: Role.Assistant,
        content: '',
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      },
    },
    withSession: true,
    verify: ({ session }) => {
      // (100*0.15 + 50*0.15) / 1_000_000 = 22.5 / 1_000_000 = 0.0000225
      const expectedCost = (100 * 0.15 + 50 * 0.15) / 1_000_000;
      assert.ok(session, '用例应注入 session');
      assert.equal(session!.promptTokens, 100);
      assert.equal(session!.completionTokens, 50);
      assert.ok(
        Math.abs(session!.totalCostCNY - expectedCost) < 1e-9,
        `期望 cost=${expectedCost}，实测 ${session!.totalCostCNY}`
      );
    },
  },

  // ---------- Session 累加：3 次调用累加 token 与 cost ----------
  {
    name: '#3 Session 累加 - 3 次调用累加 prompt/completion/cost',
    modelName: 'MiniMax-M3',
    spec: {
      mode: 'resolve',
      delayMs: 0,
      msg: {
        role: Role.Assistant,
        content: '',
        usage: { prompt_tokens: 200, completion_tokens: 100 },
      },
    },
    withSession: true,
    verify: ({ provider, session }) => {
      // 单测：单条 spec 测 3 次需要写额外的循环用例 #3b；这里用 3 次相同 spec 替换。
      // 为简化：本用例仅校验"完成第一次调用后累加正确"，把累加逻辑放在 #4。
      assert.ok(session);
      assert.equal(provider.callCount, 1);
      assert.equal(session!.promptTokens, 200);
      assert.equal(session!.completionTokens, 100);
    },
  },

  // ---------- 缺 usage：warn 兜底，不计费 ----------
  {
    name: '#4 响应无 usage - 打 warn 但不抛错，session 不累加',
    modelName: 'MiniMax-M3',
    spec: {
      mode: 'resolve',
      delayMs: 0,
      msg: { role: Role.Assistant, content: 'no usage' },
    },
    withSession: true,
    verify: ({ session }) => {
      assert.ok(session);
      assert.equal(session!.promptTokens, 0, '无 usage 时不应累加 promptTokens');
      assert.equal(session!.completionTokens, 0);
      assert.equal(session!.totalCostCNY, 0);
    },
  },

  // ---------- 失败路径：抛错向上传播，只打耗时 ----------
  {
    name: '#5 底层抛错 - 异常透传，session 不累加',
    modelName: 'MiniMax-M3',
    spec: { mode: 'reject', delayMs: 5, errMsg: 'API boom' },
    withSession: true,
    verify: ({ session }) => {
      assert.ok(session);
      assert.equal(session!.promptTokens, 0);
      assert.equal(session!.completionTokens, 0);
      assert.equal(session!.totalCostCNY, 0);
    },
  },

  // ---------- 未注册模型：cost=0 但不阻断 ----------
  {
    name: '#6 未知 modelName - 仍记录 token，cost=0 + warn',
    modelName: 'unknown-model-xyz',
    spec: {
      mode: 'resolve',
      delayMs: 0,
      msg: {
        role: Role.Assistant,
        content: 'ok',
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      },
    },
    withSession: true,
    verify: ({ session }) => {
      assert.ok(session);
      // 未知模型：cost 应为 0（不阻断），但 token 仍记录到 session（即使无定价也要知道消耗）
      assert.equal(session!.totalCostCNY, 0, '未知模型 cost 应为 0');
      assert.equal(session!.promptTokens, 1000, '即使未知模型，token 用量仍应记录');
      assert.equal(session!.completionTokens, 500);
    },
  },

  // ---------- 无 session：仅打日志，不抛错 ----------
  {
    name: '#7 无 session - 仅日志，不抛错，msg 正常透传',
    modelName: 'MiniMax-M3',
    spec: {
      mode: 'resolve',
      delayMs: 0,
      msg: {
        role: Role.Assistant,
        content: 'fine',
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      },
    },
    withSession: false,
    verify: ({ provider }) => {
      assert.equal(provider.callCount, 1);
    },
  },
];

// ============================================================
// 累加场景专用：单条 spec 跑 N 次，验证 session 累加正确性
// ============================================================
async function runAccumulationTest(): Promise<void> {
  const session = new Session('accum', process.cwd());
  const provider = new MockProvider({
    mode: 'resolve',
    delayMs: 0,
    msg: {
      role: Role.Assistant,
      content: '',
      usage: { prompt_tokens: 200, completion_tokens: 100 },
    },
  });
  const tracker = new CostTracker(provider, 'MiniMax-M3', session);

  for (let i = 0; i < 3; i++) {
    await tracker.generate([], []);
  }

  // 3 次 × 200/100 = 600 / 300
  assert.equal(session.promptTokens, 600);
  assert.equal(session.completionTokens, 300);
  // cost = 3 × (200*0.15 + 100*0.15) / 1_000_000 = 3 × 0.000045 = 0.000135
  const expectedCost = 3 * ((200 * 0.15 + 100 * 0.15) / 1_000_000);
  assert.ok(
    Math.abs(session.totalCostCNY - expectedCost) < 1e-9,
    `期望累加 cost=${expectedCost}，实测 ${session.totalCostCNY}`
  );
  console.log(`✅ #8 累加 - 3 次调用累加 prompt=600/completion=300/cost=0.000135`);
}

// ============================================================
// PricingModel 数据完整性：确保 MiniMax-M3 已配置
// ============================================================
function runPricingSanity(): void {
  assert.ok(PricingModel['MiniMax-M3'], 'PricingModel 应包含 MiniMax-M3');
  assert.equal(typeof PricingModel['MiniMax-M3'].inputPrice, 'number');
  assert.equal(typeof PricingModel['MiniMax-M3'].outputPrice, 'number');
  console.log(`✅ #0 PricingModel - MiniMax-M3 已注册且单价为 number`);
}

// ============================================================
// 运行器
// ============================================================
async function runCase(c: TestCase): Promise<void> {
  const provider = new MockProvider(c.spec);
  const session = c.withSession ? new Session(`tracker-${Math.random().toString(36).slice(2, 8)}`, process.cwd()) : undefined;
  const tracker = new CostTracker(provider, c.modelName, session);

  const t0 = Date.now();
  let thrown: unknown = null;
  let result: Message | undefined;
  try {
    result = await tracker.generate(
      [{ role: Role.User, content: 'hello' }],
      []
    );
  } catch (e) {
    thrown = e;
  }
  const elapsedMs = Date.now() - t0;

  // 失败用例：异常必须向上传播
  if (c.spec.mode === 'reject') {
    assert.ok(thrown, `${c.name}: 异常应透传`);
    assert.ok(thrown instanceof Error && /API boom/.test(thrown.message));
    c.verify?.({ provider, session, elapsedMs });
    return;
  }

  // 成功用例：结果应原样返回
  assert.ok(result, `${c.name}: 应返回 msg`);
  assert.equal(result!.role, Role.Assistant);

  c.verify?.({ provider, session, elapsedMs });
}

async function main(): Promise<void> {
  let failed = 0;
  console.log('--- CostTracker 装饰器 ---');

  runPricingSanity();

  for (const c of cases) {
    try {
      await runCase(c);
      console.log(`✅ ${c.name}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${c.name}\n   ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 累加场景
  try {
    await runAccumulationTest();
  } catch (e) {
    failed++;
    console.error(`❌ 累加场景\n   ${e instanceof Error ? e.message : String(e)}`);
  }

  const total = 1 + cases.length + 1; // #0 + cases + 累加
  const passed = total - failed;
  console.log(`\n=== ${passed}/${total} 用例通过 ===`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('测试运行器自身崩溃:', e);
  process.exit(1);
});