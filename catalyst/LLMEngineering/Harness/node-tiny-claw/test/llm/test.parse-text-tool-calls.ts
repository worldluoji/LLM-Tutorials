/**
 * test.parse-text-tool-calls.ts
 *
 * parseTextToolCalls 的纯函数单元测试（不依赖网络）。
 * 验证 MiniMaxProvider 在模型把 tool_call 塞进 content 文本时的兜底解析能力。
 *
 * 运行：pnpm test --parse-text-tool-calls
 */
import assert from 'node:assert/strict';

import {
  parseTextToolCalls,
  stripTextToolCallBlocks,
} from '../../src/llm/minimax-provider.ts';

interface ParseTestCase {
  name: string;
  input: string;
  expected: Array<{ id: string; name: string; arguments: string }>;
}

interface StripTestCase {
  name: string;
  input: string;
  expected: string;
}

const testCases: ParseTestCase[] = [
  {
    name: '#1 单个 bash 文本 tool_call - 标准格式',
    input: `<tool_call>
invoke
{"name": "bash", "arguments": {"command": "git add ping.ts"}}
</tool_call>`,
    expected: [
      {
        id: 'text_call_0',
        name: 'bash',
        arguments: '{"command":"git add ping.ts"}',
      },
    ],
  },
  {
    name: '#2 多个并行文本 tool_call - 都被提取',
    input: `<tool_call>
invoke
{"name": "bash", "arguments": {"command": "ls"}}
</tool_call>
<tool_call>
invoke
{"name": "read_file", "arguments": {"path": "ping.ts"}}
</tool_call>`,
    expected: [
      { id: 'text_call_0', name: 'bash', arguments: '{"command":"ls"}' },
      { id: 'text_call_1', name: 'read_file', arguments: '{"path":"ping.ts"}' },
    ],
  },
  {
    name: '#3 content 里夹杂普通文字 + 工具调用 - 只提取 tool_call 部分',
    input: `好的，我现在帮你写文件。
<tool_call>
invoke
{"name": "write_file", "arguments": {"path": "x.ts", "content": "hi"}}
</tool_call>
文件已经写好了。`,
    expected: [
      {
        id: 'text_call_0',
        name: 'write_file',
        arguments: '{"path":"x.ts","content":"hi"}',
      },
    ],
  },
  {
    name: '#4 arguments 已经是字符串 - 透传',
    input: `<tool_call>
invoke
{"name": "bash", "arguments": "ls -la"}
</tool_call>`,
    expected: [{ id: 'text_call_0', name: 'bash', arguments: 'ls -la' }],
  },
  {
    name: '#5 完全不含 tool_call 块 - 返回空数组',
    input: '普通的助手回复，没有任何工具调用。',
    expected: [],
  },
  {
    name: '#6 空字符串 - 返回空数组',
    input: '',
    expected: [],
  },
  {
    name: '#7 JSON 格式损坏 - 静默跳过',
    input: `<tool_call>
invoke
{"name": "bash", "arguments": {"command":
</tool_call>`,
    expected: [],
  },
  {
    name: '#8 缺 name 字段 - 静默跳过',
    input: `<tool_call>
invoke
{"arguments": {"command": "ls"}}
</tool_call>`,
    expected: [],
  },
  {
    name: '#9 name 为空字符串 - 静默跳过',
    input: `<tool_call>
invoke
{"name": "", "arguments": {}}
</tool_call>`,
    expected: [],
  },
  {
    name: '#10 缺 arguments 字段 - 默认空对象',
    input: `<tool_call>
invoke
{"name": "bash"}
</tool_call>`,
    expected: [{ id: 'text_call_0', name: 'bash', arguments: '{}' }],
  },
  {
    name: '#11 arguments 是非对象非字符串 - 默认空对象',
    input: `<tool_call>
invoke
{"name": "bash", "arguments": 123}
</tool_call>`,
    expected: [{ id: 'text_call_0', name: 'bash', arguments: '{}' }],
  },
  {
    name: '#12 无 invoke 关键字 - 简化风格也能识别',
    input: `<tool_call>
{"name": "write_file", "arguments": {"path": "ping.ts", "content": "hi"}}
</tool_call>`,
    expected: [
      {
        id: 'text_call_0',
        name: 'write_file',
        arguments: '{"path":"ping.ts","content":"hi"}',
      },
    ],
  },
  {
    name: '#13 多个无 invoke 风格并行 - 全部识别',
    input: `<tool_call>
{"name": "bash", "arguments": {"command": "ls"}}
</tool_call>
<tool_call>
{"name": "read_file", "arguments": {"path": "x.ts"}}
</tool_call>`,
    expected: [
      { id: 'text_call_0', name: 'bash', arguments: '{"command":"ls"}' },
      { id: 'text_call_1', name: 'read_file', arguments: '{"path":"x.ts"}' },
    ],
  },
  {
    name: '#14 混用风格（一个带 invoke，一个不带）- 都能识别',
    input: `<tool_call>
invoke
{"name": "bash", "arguments": {"command": "ls"}}
</tool_call>
<tool_call>
{"name": "write_file", "arguments": {"path": "x.ts"}}
</tool_call>`,
    expected: [
      { id: 'text_call_0', name: 'bash', arguments: '{"command":"ls"}' },
      {
        id: 'text_call_1',
        name: 'write_file',
        arguments: '{"path":"x.ts"}',
      },
    ],
  },
];

function runCase(c: ParseTestCase): void {
  const actual = parseTextToolCalls(c.input);
  assert.equal(
    actual.length,
    c.expected.length,
    `${c.name}: 期望 ${c.expected.length} 个 tool_call，实际 ${actual.length} 个`
  );
  for (let i = 0; i < c.expected.length; i++) {
    assert.equal(actual[i].id, c.expected[i].id, `${c.name}[${i}].id`);
    assert.equal(actual[i].name, c.expected[i].name, `${c.name}[${i}].name`);
    assert.equal(
      actual[i].arguments,
      c.expected[i].arguments,
      `${c.name}[${i}].arguments`
    );
  }
}

// ==========================================
// stripTextToolCallBlocks 测试用例
// ==========================================
const stripTestCases: StripTestCase[] = [
  {
    name: 'S#1 单个 tool_call 块 - 块被删，叙述保留',
    input: '我先看一下目录。\n<tool_call>\ninvoke\n{"name": "bash", "arguments": {"command": "ls"}}\n</tool_call>\n好的，准备下一步。',
    expected: '我先看一下目录。\n\n好的，准备下一步。',
  },
  {
    name: 'S#2 多个 tool_call 块 - 全部被删',
    input: '<tool_call>\ninvoke\n{"name": "bash", "arguments": {"command": "ls"}}\n</tool_call>\n中间叙述。\n<tool_call>\ninvoke\n{"name": "read_file", "arguments": {"path": "x"}}\n</tool_call>\n',
    expected: '中间叙述。',
  },
  {
    name: 'S#3 无 tool_call 块 - 原样返回（仅 trim）',
    input: '   普通回复，没有任何工具调用。  ',
    expected: '普通回复，没有任何工具调用。',
  },
  {
    name: 'S#4 空字符串 - 返回空字符串',
    input: '',
    expected: '',
  },
  {
    name: 'S#5 只有 tool_call 块无叙述 - 返回空字符串',
    input: '<tool_call>\ninvoke\n{"name": "bash", "arguments": {"command": "ls"}}\n</tool_call>',
    expected: '',
  },
  {
    name: 'S#6 块后多余的尾随空格 + 换行被规范化',
    input: '叙述。\n<tool_call>\ninvoke\n{"name": "bash", "arguments": {"command": "ls"}}\n</tool_call>   \n',
    expected: '叙述。',
  },
];

function runStripCase(c: StripTestCase): void {
  const actual = stripTextToolCallBlocks(c.input);
  assert.equal(actual, c.expected, `${c.name}\n   期望: ${JSON.stringify(c.expected)}\n   实际: ${JSON.stringify(actual)}`);
}

function main(): void {
  let failed = 0;

  console.log('--- parseTextToolCalls ---');
  for (const c of testCases) {
    try {
      runCase(c);
      console.log(`✅ ${c.name}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${c.name}\n   ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log('\n--- stripTextToolCallBlocks ---');
  for (const c of stripTestCases) {
    try {
      runStripCase(c);
      console.log(`✅ ${c.name}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${c.name}\n   ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const total = testCases.length + stripTestCases.length;
  console.log(`\n=== ${total - failed}/${total} 用例通过 ===`);
  if (failed > 0) process.exit(1);
}

main();