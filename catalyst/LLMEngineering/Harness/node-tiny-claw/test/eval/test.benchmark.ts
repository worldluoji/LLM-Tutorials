/**
 * test.benchmark.ts
 *
 * 表格驱动测试：验证 BenchmarkRunner 的跑分流程。
 * 不依赖真实 LLM（注入 MockProviderFactory），但用真实 fs + execSync 跑 setup/validate 脚本。
 *
 * 对应教程：19. Benchmark.md
 *
 * 运行：pnpm test --benchmark
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { BenchmarkRunner, ProviderFactory, TestCase, TestResult } from '../../src/eval/benchmark.ts';
import { LLMProvider } from '../../src/llm/llm-provider.ts';
import { Message, Role, ToolDefinition } from '../../src/schema/message.ts';

type AbortSignal = globalThis.AbortSignal;

// ============================================================
// MockProvider: 一次 generate 返回 done，不真的调任何工具
// 用例可通过 setupScript 在沙箱里准备好"靶机文件"，
// Agent 不需要真正修改它们就能让 validateScript 通过。
// ============================================================
class MockProvider implements LLMProvider {
  callCount = 0;
  async generate(_msgs: Message[], _tools: ToolDefinition[], _signal?: AbortSignal): Promise<Message> {
    this.callCount++;
    // 第一次返回无 tool_calls → 引擎认为"任务完成"，直接退出循环
    return { role: Role.Assistant, content: 'done' };
  }
}

function mockProviderFactory(): ProviderFactory {
  return (_modelName: string) => new MockProvider();
}

// ============================================================
// 工具函数：临时沙箱根目录（每个用例独立）
// ============================================================
function makeTempWorkspaceRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'benchmark-test-'));
}

function rmTempWorkspaceRoot(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}

// ============================================================
// 用例表
// ============================================================
interface BenchCase {
  name: string;
  testcases: TestCase[];
  providerFactory?: ProviderFactory;
  /** 验证结果（基于返回的 TestResult[]） */
  verify: (results: TestResult[]) => void;
}

const cases: BenchCase[] = [
  // ============================================================
  // 基础：单个用例通过
  // ============================================================
  {
    name: '#1 单用例通过 - validate 脚本 exit 0 → passed=true',
    testcases: [
      {
        id: 'tc1',
        name: 'simple pass',
        taskPrompt: 'do something',
        // setup 不需要（validate 自身会创建目标文件）
        validateScript: 'echo PASSED > result.txt',
      },
    ],
    verify: (results) => {
      assert.equal(results.length, 1);
      assert.equal(results[0].testCaseId, 'tc1');
      assert.equal(results[0].passed, true);
      assert.equal(typeof results[0].durationMs, 'number');
      assert.ok(results[0].durationMs >= 0);
      assert.equal(typeof results[0].totalCostCNY, 'number');
      assert.equal(results[0].errorMsg, undefined);
    },
  },

  // ============================================================
  // 基础：单个用例失败
  // ============================================================
  {
    name: '#2 单用例失败 - validate 脚本 exit 1 → passed=false + 错误信息',
    testcases: [
      {
        id: 'tc2',
        name: 'simple fail',
        taskPrompt: 'do something else',
        validateScript: 'echo "EXPECTED X BUT GOT Y" >&2; exit 1',
      },
    ],
    verify: (results) => {
      assert.equal(results.length, 1);
      assert.equal(results[0].passed, false);
      assert.ok(results[0].errorMsg?.includes('验证脚本执行失败'));
      assert.ok(
        results[0].errorMsg?.includes('EXPECTED X BUT GOT Y') ||
          results[0].validateOutput?.includes('EXPECTED X BUT GOT Y'),
        '错误信息应包含 validate 脚本输出'
      );
    },
  },

  // ============================================================
  // setup 脚本执行
  // ============================================================
  {
    name: '#3 setup 脚本成功 - 在沙箱里创建靶机文件，validate 验证文件存在',
    testcases: [
      {
        id: 'tc3',
        name: 'setup creates target',
        taskPrompt: 'noop',
        setupScript: 'echo "target-content" > target.txt',
        // validate 检查 setup 是否成功（Agent 不参与也能过，因为靶机已被 setup 准备好）
        validateScript: 'test -f target.txt && grep -q target-content target.txt',
      },
    ],
    verify: (results) => {
      assert.equal(results.length, 1);
      assert.equal(results[0].passed, true, 'setup 创建的文件应在沙箱里被 validate 找到');
    },
  },

  // ============================================================
  // setup 脚本失败
  // ============================================================
  {
    name: '#4 setup 脚本失败 - 提前终止 + passed=false（不应跑 Agent）',
    testcases: [
      {
        id: 'tc4',
        name: 'setup fails',
        taskPrompt: 'noop',
        setupScript: 'echo "boom" >&2; exit 99',
        validateScript: 'echo "should never run"',
      },
    ],
    verify: (results) => {
      assert.equal(results.length, 1);
      assert.equal(results[0].passed, false);
      assert.ok(results[0].errorMsg?.includes('靶机 Setup 失败'));
    },
  },

  // ============================================================
  // 沙箱隔离：两个用例的 sandboxDir 必须独立
  // ============================================================
  {
    name: '#5 沙箱隔离 - 两个用例各自的 setup 文件互不影响',
    testcases: [
      {
        id: 'tc5a',
        name: 'first case',
        taskPrompt: 'noop',
        setupScript: 'echo "alpha" > marker.txt',
        validateScript: 'test -f marker.txt && grep -q alpha marker.txt',
      },
      {
        id: 'tc5b',
        name: 'second case',
        taskPrompt: 'noop',
        setupScript: 'echo "beta" > marker.txt',
        validateScript: 'test -f marker.txt && grep -q beta marker.txt',
      },
    ],
    verify: (results) => {
      assert.equal(results.length, 2);
      assert.equal(results[0].passed, true, 'tc5a 应在独立沙箱里看到 alpha');
      assert.equal(results[1].passed, true, 'tc5b 应在独立沙箱里看到 beta（不被 tc5a 污染）');
    },
  },

  // ============================================================
  // 用例执行顺序：results 数组顺序与输入顺序一致
  // ============================================================
  {
    name: '#6 结果顺序 - results 数组严格匹配输入 testcases 顺序',
    testcases: [
      { id: 'a', name: 'a', taskPrompt: '', validateScript: 'true' },
      { id: 'b', name: 'b', taskPrompt: '', validateScript: 'true' },
      { id: 'c', name: 'c', taskPrompt: '', validateScript: 'true' },
    ],
    verify: (results) => {
      assert.deepEqual(
        results.map((r) => r.testCaseId),
        ['a', 'b', 'c']
      );
    },
  },

  // ============================================================
  // 成本累加：每个用例的成本 = Session.TotalCostCNY
  // ============================================================
  {
    name: '#7 成本字段 - totalCostCNY 是数字且 >= 0（mock provider 不产生 cost）',
    testcases: [
      { id: 'tc7', name: 'cost check', taskPrompt: '', validateScript: 'true' },
    ],
    verify: (results) => {
      assert.equal(results.length, 1);
      assert.equal(typeof results[0].totalCostCNY, 'number');
      assert.ok(results[0].totalCostCNY >= 0);
    },
  },

  // ============================================================
  // 空用例列表
  // ============================================================
  {
    name: '#8 空用例列表 - 返回 []，不抛错',
    testcases: [],
    verify: (results) => {
      assert.deepEqual(results, []);
    },
  },
];

// ============================================================
// 运行器
// ============================================================
async function runCase(c: BenchCase): Promise<void> {
  const workspaceRoot = makeTempWorkspaceRoot();
  try {
    const runner = new BenchmarkRunner({
      providerFactory: c.providerFactory ?? mockProviderFactory(),
      modelName: 'mock-model',
      workspaceRoot,
    });
    const results = await runner.runSuite(c.testcases);
    c.verify(results);
  } finally {
    rmTempWorkspaceRoot(workspaceRoot);
  }
}

async function main(): Promise<void> {
  let failed = 0;
  for (const c of cases) {
    try {
      await runCase(c);
      console.log(`✅ ${c.name}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${c.name}\n   ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n=== ${cases.length - failed}/${cases.length} 用例通过 ===`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('测试运行器自身崩溃:', e);
  process.exit(1);
});