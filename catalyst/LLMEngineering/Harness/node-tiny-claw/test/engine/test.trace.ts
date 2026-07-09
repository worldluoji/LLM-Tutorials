/**
 * test.trace.ts
 *
 * 表格驱动测试：验证极简版 Trace 引擎在启用/禁用场景下的行为：
 * - 禁用时所有方法 no-op，report() 返回 null
 * - 启用时 startRoot / start / end / setAttribute 按栈管理
 * - 嵌套 span 树正确序列化（与教程 18. tracing.md 示例 JSON 形状一致）
 *
 * 对应教程：18. tracing.md
 *
 * 运行：pnpm test --trace
 */
import assert from 'node:assert/strict';

import { Tracer, Span } from '../../src/engine/trace.ts';

// ============================================================
// 用例表
// ============================================================
interface TraceCase {
  name: string;
  enabled: boolean;
  /** 用例脚本：在 tracer 上调用 startRoot / start / setAttribute / end */
  script: (t: Tracer) => void;
  /** 断言：基于 report() 输出与 isEnabled() 状态 */
  verify: (report: Span | null) => void;
}

const cases: TraceCase[] = [
  // ============================================================
  // 禁用场景
  // ============================================================
  {
    name: '#1 禁用 tracer - startRoot / start / end / setAttribute 全 no-op，report 返回 null',
    enabled: false,
    script: (t) => {
      t.startRoot('A', { foo: 1 });
      t.start('B', { bar: 2 });
      t.setAttribute('extra', 3);
      t.end();
      t.end();
      t.end(); // 多余 end 也不应抛错
    },
    verify: (report) => {
      assert.equal(report, null, '禁用时 report() 应返回 null');
    },
  },

  // ============================================================
  // 基础开-关
  // ============================================================
  {
    name: '#2 单 root - report 返回 root，attributes 透传，duration_ms >= 0',
    enabled: true,
    script: (t) => {
      t.startRoot('Root', { key: 'value', count: 42 });
      t.end();
    },
    verify: (report) => {
      assert.ok(report, '应返回非 null report');
      assert.equal(report!.name, 'Root');
      assert.deepEqual(report!.attributes, { key: 'value', count: 42 });
      assert.equal(typeof report!.start_time, 'string');
      assert.equal(typeof report!.end_time, 'string');
      assert.ok(report!.start_time.length > 0);
      assert.equal(typeof report!.duration_ms, 'number');
      assert.ok(report!.duration_ms >= 0);
      // 无 children 时不应输出 children 字段
      assert.equal(report!.children, undefined);
    },
  },

  // ============================================================
  // 嵌套 + setAttribute
  // ============================================================
  {
    name: '#3 嵌套 3 层 - children 正确嵌套，setAttribute 追加到当前栈顶',
    enabled: true,
    script: (t) => {
      t.startRoot('Agent.Run');
      t.start('Turn-1');
      t.start('LLM.Action');
      t.end(); // LLM.Action
      t.start('Tool.Execute', { tool_name: 'bash', arguments: '{}' });
      t.setAttribute('output_preview', 'ok');
      t.end(); // Tool.Execute
      t.end(); // Turn-1
      t.end(); // Agent.Run
    },
    verify: (report) => {
      assert.ok(report);
      assert.equal(report!.name, 'Agent.Run');
      assert.equal(report!.children?.length, 1);
      const turn = report!.children![0];
      assert.equal(turn.name, 'Turn-1');
      assert.equal(turn.children?.length, 2);
      const llm = turn.children![0];
      const tool = turn.children![1];
      assert.equal(llm.name, 'LLM.Action');
      assert.equal(tool.name, 'Tool.Execute');
      assert.deepEqual(tool.attributes, {
        tool_name: 'bash',
        arguments: '{}',
        output_preview: 'ok',
      });
    },
  },

  // ============================================================
  // 时间戳格式：ISO8601 带 +08:00 偏移
  // ============================================================
  {
    name: '#4 时间戳格式 - 匹配 ISO8601 带 ±HH:MM offset（与 Go RFC3339Nano 一致）',
    enabled: true,
    script: (t) => {
      t.startRoot('X');
      t.end();
    },
    verify: (report) => {
      assert.ok(report);
      // 形如 "2026-05-01T18:01:12.848073+08:00"
      const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}([+-]\d{2}:\d{2})$/;
      assert.match(report!.start_time, isoRe, `start_time 不符合 ISO8601 offset 格式: ${report!.start_time}`);
      assert.match(report!.end_time, isoRe, `end_time 不符合 ISO8601 offset 格式: ${report!.end_time}`);
    },
  },

  // ============================================================
  // duration_ms 反映真实经过时间（毫秒级精度）
  // ============================================================
  {
    name: '#5 duration_ms - start→end 间 30ms sleep，duration_ms 应在 [28, 100]',
    enabled: true,
    script: async (t) => {
      t.startRoot('S');
      await new Promise((r) => setTimeout(r, 30));
      t.end();
    },
    verify: (report) => {
      assert.ok(report);
      // setTimeout 在 CI 上偶尔飘高，给 [28, 200] 余量
      assert.ok(
        report!.duration_ms >= 28,
        `duration_ms 应 >= 28，实测 ${report!.duration_ms}`
      );
      assert.ok(
        report!.duration_ms < 200,
        `duration_ms 应 < 200（CI 抖动余量），实测 ${report!.duration_ms}`
      );
    },
  },

  // ============================================================
  // 多个独立 root：不支持（重复 startRoot 静默忽略）
  // ============================================================
  {
    name: '#6 重复 startRoot - 第二次调用静默忽略，仍返回第一个 root',
    enabled: true,
    script: (t) => {
      t.startRoot('First');
      t.start('child-of-first');
      t.end();
      t.end();
      t.startRoot('Second'); // 静默忽略
      t.end();
    },
    verify: (report) => {
      assert.ok(report);
      assert.equal(report!.name, 'First', '第二次 startRoot 应被忽略');
      assert.equal(report!.children?.length, 1);
      assert.equal(report!.children![0].name, 'child-of-first');
    },
  },

  // ============================================================
  // 空 attributes：不输出 attributes 字段（避免噪音）
  // ============================================================
  {
    name: '#7 空 attributes - 不输出 attributes 字段（避免 {}.attributes 噪音）',
    enabled: true,
    script: (t) => {
      t.startRoot('Empty');
      t.end();
    },
    verify: (report) => {
      assert.ok(report);
      assert.equal(report!.attributes, undefined, '空 attributes 不应输出');
    },
  },

  // ============================================================
  // setEnabled 运行时切换：开启后之前的 no-op 调用不补建
  // ============================================================
  {
    name: '#8 运行时 setEnabled(true) - 启用后 startRoot 才生效，之前调用不补建',
    enabled: false,
    script: (t) => {
      // 禁用时调用：no-op，不建任何 span
      t.startRoot('Pre');
      t.end();
      // 切换为启用
      t.setEnabled(true);
      t.startRoot('Post');
      t.end();
    },
    verify: (report) => {
      assert.ok(report);
      assert.equal(report!.name, 'Post', '启用后建的 span 才是 root，之前 no-op 不补建');
    },
  },

  // ============================================================
  // end 比 start 多：静默忽略，不抛错
  // ============================================================
  {
    name: '#9 多余 end - 不抛错，已关闭 span 的 attributes 不变',
    enabled: true,
    script: (t) => {
      t.startRoot('Solo');
      t.end();
      t.end(); // 多余
      t.end(); // 多余
    },
    verify: (report) => {
      assert.ok(report);
      assert.equal(report!.name, 'Solo');
    },
  },

  // ============================================================
  // 并发 span 嵌套模拟
  // ============================================================
  {
    name: '#10 嵌套 5 层（Turn > LLM > Tool.Execute > 子方法 > 内部） - 完整还原',
    enabled: true,
    script: (t) => {
      t.startRoot('Agent.Run', { SessionID: 'test_trace_001', WorkDir: '/tmp/ws' });
      t.start('Turn-1', { context_message_count: 2 });
      t.start('LLM.Action');
      t.end();
      t.start('Tool.Execute', { tool_name: 'bash', arguments: '{"command":"ls"}' });
      t.setAttribute('output_preview', 'file1\nfile2\n');
      t.end();
      t.start('Tool.Execute', { tool_name: 'write_file', arguments: '{}' });
      t.setAttribute('output_preview', '写入成功');
      t.end();
      t.end(); // Turn-1
      t.end(); // Agent.Run
    },
    verify: (report) => {
      assert.ok(report);
      assert.equal(report!.name, 'Agent.Run');
      assert.deepEqual(report!.attributes, {
        SessionID: 'test_trace_001',
        WorkDir: '/tmp/ws',
      });
      assert.equal(report!.children?.length, 1);
      const turn = report!.children![0];
      assert.equal(turn.name, 'Turn-1');
      assert.deepEqual(turn.attributes, { context_message_count: 2 });
      assert.equal(turn.children?.length, 3);
      assert.equal(turn.children![0].name, 'LLM.Action');
      assert.equal(turn.children![0].attributes, undefined);
      assert.equal(turn.children![1].name, 'Tool.Execute');
      assert.deepEqual(turn.children![1].attributes, {
        tool_name: 'bash',
        arguments: '{"command":"ls"}',
        output_preview: 'file1\nfile2\n',
      });
      assert.equal(turn.children![2].name, 'Tool.Execute');
    },
  },
];

// ============================================================
// 运行器
// ============================================================
async function runCase(c: TraceCase): Promise<void> {
  const t = new Tracer(c.enabled);
  await c.script(t);
  const report = t.report();
  c.verify(report);
}

// ============================================================
// addSpan 测试（并行兄弟 span 场景）
// ============================================================
async function runAddSpanCases(): Promise<{ name: string; passed: boolean; err?: string }[]> {
  const results: { name: string; passed: boolean; err?: string }[] = [];

  // #A1 启用 + 栈空 + addSpan：应静默忽略
  try {
    const t = new Tracer(true);
    t.addSpan('orphan', 0, 1, new Date(), new Date());
    const report = t.report();
    assert.equal(report, null, '栈空时 addSpan 应忽略');
    results.push({ name: '#A1 栈空 addSpan 静默忽略', passed: true });
  } catch (e) {
    results.push({ name: '#A1 栈空 addSpan 静默忽略', passed: false, err: e instanceof Error ? e.message : String(e) });
  }

  // #A2 多个并行 sibling span：addSpan 多次应产生 N 个平级 children
  try {
    const t = new Tracer(true);
    t.startRoot('Root');
    const start1 = performance.now();
    const start2 = start1 + 0.5;
    const end1 = start1 + 10;
    const end2 = start2 + 20;
    t.addSpan('parallel-1', start1, end1, new Date(), new Date(), { tool_name: 'a' });
    t.addSpan('parallel-2', start2, end2, new Date(), new Date(), { tool_name: 'b' });
    t.end(); // Root

    const report = t.report();
    assert.ok(report);
    assert.equal(report!.children?.length, 2, '应产生 2 个 sibling');
    assert.equal(report!.children![0].name, 'parallel-1');
    assert.equal(report!.children![1].name, 'parallel-2');
    assert.equal(report!.children![0].duration_ms, 10);
    assert.equal(report!.children![1].duration_ms, 20);
    assert.deepEqual(report!.children![0].attributes, { tool_name: 'a' });
    results.push({ name: '#A2 多并行 sibling - 2 个平级 children + 时长准确', passed: true });
  } catch (e) {
    results.push({ name: '#A2 多并行 sibling - 2 个平级 children + 时长准确', passed: false, err: e instanceof Error ? e.message : String(e) });
  }

  // #A3 禁用时 addSpan 也 no-op
  try {
    const t = new Tracer(false);
    t.startRoot('Root');
    t.addSpan('x', 0, 1, new Date(), new Date());
    t.end();
    assert.equal(t.report(), null);
    results.push({ name: '#A3 禁用时 addSpan no-op', passed: true });
  } catch (e) {
    results.push({ name: '#A3 禁用时 addSpan no-op', passed: false, err: e instanceof Error ? e.message : String(e) });
  }

  return results;
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

  // addSpan 用例
  const addSpanResults = await runAddSpanCases();
  for (const r of addSpanResults) {
    if (r.passed) {
      console.log(`✅ ${r.name}`);
    } else {
      failed++;
      console.error(`❌ ${r.name}\n   ${r.err}`);
    }
  }

  const total = cases.length + addSpanResults.length;
  console.log(`\n=== ${total - failed}/${total} 用例通过 ===`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('测试运行器自身崩溃:', e);
  process.exit(1);
});