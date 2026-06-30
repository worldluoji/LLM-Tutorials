/**
 * test.compactor.ts
 *
 * 表格驱动测试：验证 Compactor 在水位线告警 / 远期历史掩码 / 近期截断 / 边界场景下的行为。
 * 对应教程：11. Context Compaction.md
 *
 * 运行：pnpm test --compactor
 */
import assert from 'node:assert/strict';
import { Compactor } from '../../src/context/compactor.ts';
import { Message, Role, ToolCall } from '../../src/schema/message.ts';

// ============================================================
// 工具：构造固定 fixture
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

/** 生成重复字符的"长字符串"，长度精确可控 */
function pad(ch: string, len: number): string {
  return ch.repeat(len);
}

// ============================================================
// 表格：每个用例是一条独立的 Compactor 行为契约
// ============================================================
interface CompactCase {
  name: string;
  maxChars: number;
  retainLastMsgs: number;
  input: Message[];
  /**
   * 期望输出逐条 content：
   * - 字符串：精确相等
   * - 正则：匹配即可
   */
  expectContent: (string | RegExp)[];
  /** 期望 compact 返回的就是原数组引用（未触发压缩时的快路径） */
  expectSameReference?: boolean;
}

const compactCases: CompactCase[] = [
  // ------------------------------------------------------------
  // 1) 水位线以下：快速返回原数组，零开销
  // ------------------------------------------------------------
  {
    name: '#1 低于水位线 - 快速返回原数组（同一引用）',
    maxChars: 10000,
    retainLastMsgs: 2,
    input: [userMsg('hello'), toolResultMsg('tc_1', pad('x', 300))],
    expectContent: ['hello', pad('x', 300)],
    expectSameReference: true,
  },

  // ------------------------------------------------------------
  // 2) System Prompt 永不被改
  // ------------------------------------------------------------
  {
    name: '#2 System Prompt 永远原样保留（即使内容超长、即使在远期）',
    maxChars: 50, // 极低水位线，强制触发压缩
    retainLastMsgs: 1,
    input: [
      sysMsg(pad('S', 500)), // 超长 system
      toolResultMsg('tc_1', pad('T', 300)), // 远期 tool_result 应被掩码
      userMsg('最后一条'),
    ],
    expectContent: [pad('S', 500), /为了节省内存.*原始长度: 300 字节/, '最后一条'],
  },

  // ------------------------------------------------------------
  // 3) 远期工具结果：>200 字符触发 Full Masking
  // ------------------------------------------------------------
  {
    name: '#3 远期 tool_result 长度 > 200 - Full Masking 替换为占位说明',
    maxChars: 100,
    retainLastMsgs: 1, // 仅最后 1 条受保护，前面的全部"远期"
    input: [
      toolResultMsg('tc_old', pad('a', 250)), // 远期，长 > 200
      userMsg('最后一条'),
    ],
    expectContent: [/原始长度: 250 字节/, '最后一条'],
  },

  // ------------------------------------------------------------
  // 4) 远期工具结果：≤200 字符保留（短结果本身就是有效信息）
  // ------------------------------------------------------------
  {
    name: '#4 远期 tool_result 长度 <= 200 - 保留不变（短结果不该被吞）',
    maxChars: 50,
    retainLastMsgs: 1,
    input: [
      toolResultMsg('tc_old', pad('a', 200)), // 远期，长恰好 200（条件是 > 200，所以保留）
      userMsg('tail'),
    ],
    expectContent: [pad('a', 200), 'tail'],
  },

  // ------------------------------------------------------------
  // 5) 近期 Working Memory 中单条超长：触发 Head-Tail Truncation
  // ------------------------------------------------------------
  {
    name: '#5 近期 tool_result 长度 > 1000 - Head-Tail Truncation（掐头去尾）',
    maxChars: 100,
    retainLastMsgs: 5, // 全部消息都在保护区
    input: [
      toolResultMsg(
        'tc_1',
        pad('H', 500) + pad('M', 2000) + pad('T', 500) // 总长 3000，头尾各 500，中间 2000 被丢
      ),
    ],
    expectContent: [
      new RegExp(`^${pad('H', 500)}\\n\\n\\.\\.\\.\\[内容过长，中间 2000 字节已被系统截断\\]\\.\\.\\.\\n\\n${pad('T', 500)}$`),
    ],
  },

  // ------------------------------------------------------------
  // 6) 近期 Working Memory 中单条不超长：不动
  // ------------------------------------------------------------
  {
    name: '#6 近期 tool_result 长度 <= 1000 - 原样保留',
    maxChars: 50,
    retainLastMsgs: 5,
    input: [
      toolResultMsg('tc_1', pad('a', 1000)), // 边界：条件 > 1000，所以 1000 字符不动
    ],
    expectContent: [pad('a', 1000)],
  },

  // ------------------------------------------------------------
  // 7) Assistant 远期推理 trace：>200 折叠为占位
  // ------------------------------------------------------------
  {
    name: '#7 远期 Assistant 推理 trace 长度 > 200 - 折叠为占位',
    maxChars: 50,
    retainLastMsgs: 1,
    input: [
      asstMsg(pad('z', 250)), // 远期 thinking trace
      userMsg('tail'),
    ],
    expectContent: ['...[早期的推理思考过程已折叠]...', 'tail'],
  },

  // ------------------------------------------------------------
  // 8) Assistant 近期推理 trace：即使很长也不折叠（thinking 可能有价值）
  // ------------------------------------------------------------
  {
    name: '#8 近期 Assistant 推理 trace - 永远保留',
    maxChars: 50,
    retainLastMsgs: 5,
    input: [asstMsg(pad('Z', 500))],
    expectContent: [pad('Z', 500)],
  },

  // ------------------------------------------------------------
  // 9) ToolCall 字段永不被改：那是逻辑链证据
  // ------------------------------------------------------------
  {
    name: '#9 Assistant 的 tool_calls 永不被压缩（即使所在 Assistant.content 被折叠）',
    maxChars: 50,
    retainLastMsgs: 1,
    input: [
      asstMsg(pad('thinking...', 300), [
        { id: 'tc_a', name: 'bash', arguments: { command: 'cat huge.log' } },
      ]),
      userMsg('tail'),
    ],
    expectContent: ['...[早期的推理思考过程已折叠]...', 'tail'],
    // 单独断言 tool_calls 未被动过
    expectToolCallsUnchanged: [
      {
        idx: 0,
        expected: [
          {
            id: 'tc_a',
            name: 'bash',
            arguments: { command: 'cat huge.log' },
          },
        ],
      },
    ],
  } as CompactCase & { expectToolCallsUnchanged: { idx: number; expected: unknown[] }[] },

  // ------------------------------------------------------------
  // 10) 阈值边界：currentLength === maxChars 触发压缩（条件是 <）
  // ------------------------------------------------------------
  {
    name: '#10 边界：currentLength === maxChars 仍触发压缩',
    maxChars: 500, // 精确等于输入总长度（system 300 + tool_result 200）
    retainLastMsgs: 0,
    input: [
      sysMsg(pad('S', 300)), // 300
      toolResultMsg('tc_1', pad('x', 200)), // 200，恰好在边界
    ],
    expectContent: [pad('S', 300), pad('x', 200)], // system 不动；tool_result 因为 200 <= 200 也保留
    // 触发压缩但因 mask 条件 (> 200) 不满足，所以输出几乎不变——但仍走了压缩路径
  },

  // ------------------------------------------------------------
  // 11) retainLastMsgs 超过消息总数：protectStartIndex clamp 到 0，全部算"近期"
  // ------------------------------------------------------------
  {
    name: '#11 retainLastMsgs > msgCount - 全部消息视为 Working Memory',
    maxChars: 50,
    retainLastMsgs: 999,
    input: [
      toolResultMsg('tc_1', pad('a', 300)), // 本应被掩码，但因为全是"近期"，触发截断
    ],
    expectContent: [
      // 300 > 200 但 <= 1000，所以保留不变（第二道防线只在 > 1000 时触发）
      pad('a', 300),
    ],
  },

  // ------------------------------------------------------------
  // 12) 远期工具结果被掩码后，原数组不被污染
  // ------------------------------------------------------------
  {
    name: '#12 浅拷贝：返回结果改写不污染原数组',
    maxChars: 50,
    retainLastMsgs: 0,
    input: [toolResultMsg('tc_1', pad('a', 300))],
    expectContent: [/原始长度: 300 字节/],
    expectInputUntouched: true,
  },

  // ------------------------------------------------------------
  // 13) 空数组
  // ------------------------------------------------------------
  {
    name: '#13 空数组 - 返回空数组（不报错）',
    maxChars: 50,
    retainLastMsgs: 2,
    input: [],
    expectContent: [],
  },

  // ------------------------------------------------------------
  // 14) 混合场景：远期 + 近期，验证双重降级
  // ------------------------------------------------------------
  {
    name: '#14 混合：远期大 tool_result 被掩码，近期大 tool_result 被截断',
    maxChars: 100,
    retainLastMsgs: 1, // 仅最后 1 条是 Working Memory；前 2 条都算"远期"
    input: [
      sysMsg('sys'), // system 永远保留
      toolResultMsg('tc_old', pad('a', 500)), // 远期 → 掩码（> 200）
      toolResultMsg(
        'tc_recent',
        pad('H', 500) + pad('M', 2000) + pad('T', 500) // 近期 → 截断（> 1000）
      ),
    ],
    expectContent: [
      'sys',
      /原始长度: 500 字节/,
      new RegExp(`^${pad('H', 500)}\\n\\n\\.\\.\\.\\[内容过长，中间 2000 字节已被系统截断\\]\\.\\.\\.\\n\\n${pad('T', 500)}$`),
    ],
  },
];

// ============================================================
// estimateLength 表格
// ============================================================
interface EstimateCase {
  name: string;
  msgs: Message[];
  expected: number;
}

const estimateCases: EstimateCase[] = [
  {
    name: '#E1 空数组 - 0',
    msgs: [],
    expected: 0,
  },
  {
    name: '#E2 只算 content',
    msgs: [userMsg('abc'), userMsg('defgh')],
    expected: 8,
  },
  {
    name: '#E3 tool_calls.arguments 是字符串 - 直接取 length',
    msgs: [
      asstMsg('', [
        { id: 'tc', name: 'bash', arguments: '{"command":"ls"}' }, // 16 字符
      ]),
    ],
    expected: 4 + 16, // name="bash" (4) + args=16
  },
  {
    name: '#E4 tool_calls.arguments 是对象 - JSON 序列化后取 length',
    msgs: [
      asstMsg('', [
        { id: 'tc', name: 'x', arguments: { a: 1 } }, // JSON.stringify = '{"a":1}' = 7
      ]),
    ],
    expected: 1 + 7,
  },
  {
    name: '#E5 多条 tool_call 累加',
    msgs: [
      asstMsg('hi', [
        { id: 'a', name: 'aa', arguments: 'AAA' }, // 2+3=5
        { id: 'b', name: 'bb', arguments: 'BBBB' }, // 2+4=6
      ]),
    ],
    expected: 2 + 5 + 6,
  },
];

// ============================================================
// 运行器
// ============================================================
function matchContent(actual: string, expected: string | RegExp): boolean {
  if (typeof expected === 'string') return actual === expected;
  return expected.test(actual);
}

function runCompactCases(): number {
  let failed = 0;
  console.log('--- Compactor.compact ---');
  for (const c of compactCases) {
    try {
      // 拷贝输入：防止 compact 内部错误地修改原数组时影响后续断言
      const inputSnapshot = JSON.parse(JSON.stringify(c.input));
      const compactor = new Compactor(c.maxChars, c.retainLastMsgs);
      const result = compactor.compact(c.input);

      // 长度
      assert.equal(
        result.length,
        c.expectContent.length,
        `${c.name}: 期望 ${c.expectContent.length} 条，实际 ${result.length} 条`
      );

      // 引用快速返回
      if (c.expectSameReference) {
        assert.strictEqual(
          result,
          c.input,
          `${c.name}: 水位线未触发时应当返回同一引用（零拷贝快路径）`
        );
      }

      // 内容逐条
      result.forEach((m, i) => {
        assert.ok(
          matchContent(m.content, c.expectContent[i]),
          `${c.name}: 第 ${i} 条 content 不匹配\n  期望: ${c.expectContent[i]}\n  实际: ${JSON.stringify(m.content)}`
        );
      });

      // tool_calls 不被改（扩展断言）
      const extra = c as CompactCase & { expectToolCallsUnchanged?: { idx: number; expected: unknown[] }[] };
      if (extra.expectToolCallsUnchanged) {
        for (const check of extra.expectToolCallsUnchanged) {
          assert.deepEqual(result[check.idx].tool_calls, check.expected);
        }
      }

      // 原数组不被污染
      if (c.expectInputUntouched) {
        assert.deepEqual(c.input, inputSnapshot, `${c.name}: compact 不应修改原数组`);
      }

      console.log(`✅ ${c.name}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${c.name}\n   ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return failed;
}

function runEstimateCases(): number {
  let failed = 0;
  console.log('\n--- Compactor.estimateLength ---');
  for (const c of estimateCases) {
    try {
      const compactor = new Compactor(1000, 5); // 参数不影响 estimateLength
      const got = compactor.estimateLength(c.msgs);
      assert.equal(got, c.expected, `${c.name}: 期望 ${c.expected}，实际 ${got}`);
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
  failed += runCompactCases();
  failed += runEstimateCases();

  const total = compactCases.length + estimateCases.length;
  console.log(`\n=== ${total - failed}/${total} 用例通过 ===`);
  if (failed > 0) process.exit(1);
}

main();