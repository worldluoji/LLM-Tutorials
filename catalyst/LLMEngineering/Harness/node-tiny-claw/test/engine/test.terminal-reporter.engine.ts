/**
 * test.terminal-reporter.engine.ts
 *
 * 表格驱动测试：验证 TerminalReporter 在各个回调路径上的输出。
 * 测试策略：mock console.log / console.error 捕获输出。
 *
 * 运行：pnpm test --terminal-reporter
 */
import assert from 'node:assert/strict';

import {
  Reporter,
  TerminalReporter,
  newTerminalReporter,
} from '../../src/engine/terminal_reporter.ts';

interface TestCase {
  name: string;
  run: (r: Reporter) => void;
  expectLogContains?: string[];
  expectLogNotContains?: string[];
  expectErrorContains?: string[];
  expectErrorNotContains?: string[];
  expectLogSilent?: boolean;
  expectErrorSilent?: boolean;
}

const testCases: TestCase[] = [
  {
    name: '#1 onThinking - 打印思考中提示',
    run: (r) => r.onThinking(),
    expectLogContains: ['[🤔 思考中]', '模型正在推理'],
    expectErrorSilent: true,
  },
  {
    name: '#2 onToolCall 短参数 - 完整展示',
    run: (r) => r.onToolCall('bash', '{"command":"ls -la"}'),
    expectLogContains: ['[🛠️ 调用工具] bash', '参数: {"command":"ls -la"}'],
    expectErrorSilent: true,
  },
  {
    name: '#3 onToolCall 参数含 \\n \\r - 被字面化',
    run: (r) => r.onToolCall('write_file', 'line1\nline2\rline3'),
    expectLogContains: ['line1\\nline2\\rline3'],
    expectLogNotContains: ['line1\nline2'],
    expectErrorSilent: true,
  },
  {
    name: '#4 onToolCall 参数 >150 字符 - 截断并加省略标记',
    run: (r) => r.onToolCall('write_file', 'x'.repeat(200)),
    expectLogContains: ['... (已截断)'],
    expectErrorSilent: true,
  },
  {
    name: '#5 onToolCall 参数恰好 150 字符 - 不截断（边界）',
    run: (r) => r.onToolCall('write_file', 'x'.repeat(150)),
    expectLogContains: ['x'.repeat(150)],
    expectLogNotContains: ['已截断'],
    expectErrorSilent: true,
  },
  {
    name: '#6 onToolResult 成功 - 走 console.log，无错误行',
    run: (r) => r.onToolResult('bash', 'hello', false),
    expectLogContains: ['[✅ 执行成功] bash'],
    expectLogNotContains: ['错误:'],
    expectErrorSilent: true,
  },
  {
    name: '#7 onToolResult 失败 + 非空 result - 走 console.error 并打印错误',
    run: (r) => r.onToolResult('bash', 'permission denied', true),
    expectErrorContains: ['[❌ 执行失败] bash', '错误: permission denied'],
    expectLogSilent: true,
  },
  {
    name: '#8 onToolResult 失败 + 空 result - 只打标题不打错误行',
    run: (r) => r.onToolResult('bash', '', true),
    expectErrorContains: ['[❌ 执行失败] bash'],
    expectErrorNotContains: ['错误:'],
    expectLogSilent: true,
  },
  {
    name: '#9 onMessage 非空 - 打印回复',
    run: (r) => r.onMessage('任务完成'),
    expectLogContains: ['🤖 Agent 回复:', '任务完成'],
    expectErrorSilent: true,
  },
  {
    name: '#10 onMessage 空字符串 - 完全静默',
    run: (r) => r.onMessage(''),
    expectLogSilent: true,
    expectErrorSilent: true,
  },
  {
    name: '#11 newTerminalReporter 工厂返回 TerminalReporter 实例',
    run: () => {
      const r = newTerminalReporter();
      assert.ok(r instanceof TerminalReporter, '工厂函数应返回 TerminalReporter');
    },
    expectLogSilent: true,
    expectErrorSilent: true,
  },
];

// ============================================================
// mock console 工具
// ============================================================
interface ConsoleMock {
  logs: string[];
  errors: string[];
  restore: () => void;
}

function mockConsole(): ConsoleMock {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  // console.log / console.error 在 TS lib 中是只读方法，需用 defineProperty 或 any-cast
  (console as any).log = (...args: unknown[]) => {
    logs.push(args.map((a) => String(a)).join(' '));
  };
  (console as any).error = (...args: unknown[]) => {
    errors.push(args.map((a) => String(a)).join(' '));
  };

  return {
    logs,
    errors,
    restore: () => {
      (console as any).log = originalLog;
      (console as any).error = originalError;
    },
  };
}

// ============================================================
// 单 case 验证
// ============================================================
function verify(c: TestCase, mock: ConsoleMock): void {
  if (c.expectLogSilent) {
    assert.equal(
      mock.logs.length,
      0,
      `期望 console.log 完全静默，实际调用 ${mock.logs.length} 次: ${JSON.stringify(mock.logs)}`
    );
  } else {
    const allLog = mock.logs.join('\n');
    for (const s of c.expectLogContains ?? []) {
      assert.ok(
        allLog.includes(s),
        `期望 console.log 包含 '${s}'，实际: ${JSON.stringify(allLog)}`
      );
    }
    for (const s of c.expectLogNotContains ?? []) {
      assert.ok(
        !allLog.includes(s),
        `期望 console.log 不包含 '${s}'，实际: ${JSON.stringify(allLog)}`
      );
    }
  }

  if (c.expectErrorSilent) {
    assert.equal(
      mock.errors.length,
      0,
      `期望 console.error 完全静默，实际调用 ${mock.errors.length} 次: ${JSON.stringify(mock.errors)}`
    );
  } else {
    const allError = mock.errors.join('\n');
    for (const s of c.expectErrorContains ?? []) {
      assert.ok(
        allError.includes(s),
        `期望 console.error 包含 '${s}'，实际: ${JSON.stringify(allError)}`
      );
    }
    for (const s of c.expectErrorNotContains ?? []) {
      assert.ok(
        !allError.includes(s),
        `期望 console.error 不包含 '${s}'，实际: ${JSON.stringify(allError)}`
      );
    }
  }
}

// ============================================================
// 运行器
// ============================================================
async function runCase(c: TestCase): Promise<void> {
  const mock = mockConsole();
  try {
    const reporter = new TerminalReporter();
    c.run(reporter);
    verify(c, mock);
  } finally {
    mock.restore();
  }
}

async function main(): Promise<void> {
  let failed = 0;
  for (const c of testCases) {
    try {
      await runCase(c);
      console.log(`✅ ${c.name}`);
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`❌ ${c.name}\n   ${msg}`);
    }
  }
  console.log(`\n=== ${testCases.length - failed}/${testCases.length} 用例通过 ===`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('测试运行器自身崩溃:', e);
  process.exit(1);
});
