/**
 * test.composer-integration.engine.ts
 *
 * 端到端集成测试：验证 AgentEngine 的 Main Loop 真的把 PromptComposer 组装出的
 * System Prompt 喂给了 LLM Provider，而不是原来那段英文硬编码占位。
 *
 * 运行：pnpm test --composer-integration
 */
import assert from 'node:assert/strict';

import { AgentEngine } from '../../src/engine/loop.ts';
import {
  Message,
  Role,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from '../../src/schema/message.ts';
import { LLMProvider } from '../../src/llm/llm-provider.ts';
import { BaseTool, Registry } from '../../src/tools/registry.ts';
import { Session } from '../../src/engine/session.ts';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

interface FileSpec {
  /** 相对 workDir 的文件路径 */
  path: string;
  content: string;
}

interface TestCase {
  name: string;
  files: FileSpec[];
  /** 期望在 System Prompt（即 firstCallHistory[0].content）中出现的子串 */
  expectedContains?: string[];
  /** 期望 System Prompt 中不出现的子串 */
  expectedNotContains?: string[];
}

// ============================================================
// MockProvider：第 1 次 generate 时把整段 contextHistory 快照到
// firstCallHistory —— 这正是验证 System Prompt 的唯一窗口。
// 第 2 次 generate 返回 "done" 退出循环。
// ============================================================
class MockProvider implements LLMProvider {
  callCount = 0;
  firstCallHistory: Message[] = [];

  constructor(private toolCall: ToolCall) {}

  async generate(
    msgs: Message[],
    _tools: ToolDefinition[],
    _signal?: AbortSignal
  ): Promise<Message> {
    this.callCount++;
    if (this.callCount === 1) {
      this.firstCallHistory = [...msgs];
      return {
        role: Role.Assistant,
        content: '',
        tool_calls: [this.toolCall],
      } as Message;
    }
    return { role: Role.Assistant, content: 'done' } as Message;
  }
}

class MockRegistry implements Registry {
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
    return { tool_call_id: call.id, output: 'ok', is_error: false };
  }
}

// ============================================================
// 用例表
// ============================================================
const testCases: TestCase[] = [
  {
    name: '#1 无 AGENTS.md 无 skills - 极简内核注入，旧硬编码英文消失',
    files: [],
    expectedContains: [
      '你名叫 node-tiny-claw',
      '核心纪律 (CRITICAL)',
    ],
    expectedNotContains: [
      'You are node-tiny-claw, an expert coding assistant',
      'You have full access to tools in the workspace',
    ],
  },
  {
    name: '#2 有 AGENTS.md - 项目专属指南段落被注入',
    files: [
      { path: 'AGENTS.md', content: 'AGENTS-INTEGRATION-MARKER-XYZ\n' },
    ],
    expectedContains: [
      'AGENTS-INTEGRATION-MARKER-XYZ',
      '# 项目专属指南 (来自 AGENTS.md)',
      '```markdown',
    ],
    expectedNotContains: [
      '### 可用专业技能 (Agent Skills)', // 没有 skills
    ],
  },
  {
    name: '#3 有 .claw/skills/SKILL.md - 技能段落被注入',
    files: [
      {
        path: '.claw/skills/test/SKILL.md',
        content:
          '---\n' +
          'name: Integration Skill\n' +
          'description: Test the composer integration end-to-end\n' +
          '---\n' +
          '\n' +
          'Body of integration skill.\n',
      },
    ],
    expectedContains: [
      '### 可用专业技能 (Agent Skills)',
      '技能名称: Integration Skill',
      'Body of integration skill.',
    ],
    expectedNotContains: [
      '# 项目专属指南 (来自 AGENTS.md)', // 没有 AGENTS.md
    ],
  },
  {
    name: '#4 AGENTS.md + skills 联合 - 三个段落都出现',
    files: [
      { path: 'AGENTS.md', content: 'AGENTS-MARKER-COMBINED\n' },
      {
        path: '.claw/skills/x/SKILL.md',
        content:
          '---\n' +
          'name: Combined Skill\n' +
          'description: For the combined scenario\n' +
          '---\n' +
          '\n' +
          'Combined body.\n',
      },
    ],
    expectedContains: [
      '你名叫 node-tiny-claw', // core
      'AGENTS-MARKER-COMBINED', // AGENTS.md
      '技能名称: Combined Skill', // skill
      'Combined body.',
    ],
  },
];

// ============================================================
// 工具函数
// ============================================================
async function setupWorkDir(files: FileSpec[]): Promise<string> {
  const workDir = path.join(os.tmpdir(), `node-tiny-claw-composer-int-${randomUUID()}`);
  for (const f of files) {
    const fullPath = path.join(workDir, f.path);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, f.content, 'utf-8');
  }
  return workDir;
}

async function cleanupWorkDir(workDir: string): Promise<void> {
  try {
    await fs.rm(workDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// ============================================================
// 单 case 运行
// ============================================================
async function runCase(c: TestCase): Promise<void> {
  const workDir = await setupWorkDir(c.files);

  try {
    const toolCall: ToolCall = { id: 'A', name: 'fake', arguments: {} };
    const provider = new MockProvider(toolCall);
    const registry = new MockRegistry();
    const engine = new AgentEngine(provider, registry, workDir, false); // 关掉 thinking 简化
    const session = new Session('composer-integration-test', workDir);

    await engine.run(session, 'integration-test');

    // 1) System Prompt 必须存在且来自 composer
    assert.ok(
      provider.firstCallHistory.length >= 2,
      `期望 firstCallHistory 至少有 system + user 两条，实际: ${provider.firstCallHistory.length}`
    );

    const systemMsg = provider.firstCallHistory[0];
    const userMsg = provider.firstCallHistory[1];

    assert.equal(
      systemMsg.role,
      Role.System,
      `期望 [0] 是 System，实际: ${systemMsg.role}`
    );
    assert.equal(
      userMsg.role,
      Role.User,
      `期望 [1] 是 User，实际: ${userMsg.role}`
    );

    // 2) 期望子串
    for (const expected of c.expectedContains ?? []) {
      assert.ok(
        systemMsg.content.includes(expected),
        `期望 System Prompt 包含 '${expected}'，实际内容前 200 字: ${systemMsg.content.slice(0, 200)}`
      );
    }

    // 3) 不期望子串
    for (const unexpected of c.expectedNotContains ?? []) {
      assert.ok(
        !systemMsg.content.includes(unexpected),
        `期望 System Prompt 不包含 '${unexpected}'，实际内容前 200 字: ${systemMsg.content.slice(0, 200)}`
      );
    }
  } finally {
    await cleanupWorkDir(workDir);
  }
}

// ============================================================
// 运行器
// ============================================================
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
