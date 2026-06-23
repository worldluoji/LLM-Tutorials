import { PromptComposer } from '../../src/context/composer.ts';
import { Role } from '../../src/schema/message.ts';
import { logger } from '../../src/utils/logger.ts';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

/**
 * PromptComposer 测试用例（表格驱动测试）
 */

interface FileSpec {
  path: string;
  content: string;
}

interface TestCase {
  name: string;
  files: FileSpec[];
  expectedContains?: string[];
  expectedNotContains?: string[];
  /** 按数组顺序断言每个子串在 content 中出现的索引严格递增 */
  expectedOrder?: string[];
}

/** 极简内核的指纹：每个用例都必须包含，验证 CORE_IDENTITY 未被退化 */
const CORE_MARKERS = [
  '你名叫 node-tiny-claw',
  '核心纪律 (CRITICAL)',
  '始终用中文回复',
];

const testCases: TestCase[] = [
  {
    name: '无 AGENTS.md 无 skills - 只返回核心身份',
    files: [],
    expectedContains: CORE_MARKERS,
    expectedNotContains: ['项目专属指南', '可用专业技能'],
  },
  {
    name: '有 AGENTS.md 无 skills - 核心 + 项目指南',
    files: [{ path: 'AGENTS.md', content: '这个项目使用 pnpm。\n' }],
    expectedContains: [
      ...CORE_MARKERS,
      '# 项目专属指南 (来自 AGENTS.md)',
      '以下是当前工作区特有的架构规范与注意事项，你的行为必须绝对符合以下要求：',
      '```markdown',
      '这个项目使用 pnpm。',
    ],
    expectedNotContains: ['可用专业技能'],
  },
  {
    name: '有 AGENTS.md 有 skills - 三段齐全且顺序正确',
    files: [
      { path: 'AGENTS.md', content: '项目规范 A\n' },
      {
        path: '.claw/skills/test/SKILL.md',
        content:
          '---\n' +
          'name: Test Skill\n' +
          'description: Test desc\n' +
          '---\n' +
          '\n' +
          'Test body.\n',
      },
    ],
    expectedContains: [
      ...CORE_MARKERS,
      '项目规范 A',
      '### 可用专业技能 (Agent Skills)',
      '技能名称: Test Skill',
      '**触发条件**: Test desc',
      'Test body.',
    ],
    expectedOrder: [
      '你名叫 node-tiny-claw',
      '项目规范 A',
      '技能名称: Test Skill',
    ],
  },
  {
    name: '无 AGENTS.md 有 skills - 核心 + skills',
    files: [
      {
        path: '.claw/skills/only/SKILL.md',
        content:
          '---\n' +
          'name: Only Skill\n' +
          'description: Only one\n' +
          '---\n' +
          '\n' +
          'Body only.\n',
      },
    ],
    expectedContains: [
      ...CORE_MARKERS,
      '### 可用专业技能 (Agent Skills)',
      '技能名称: Only Skill',
      'Body only.',
    ],
    expectedNotContains: ['项目专属指南'],
  },
  {
    name: 'AGENTS.md 内容被 ```markdown 围栏完整包裹',
    files: [{ path: 'AGENTS.md', content: 'X-CONTENT-X' }],
    expectedContains: ['```markdown\nX-CONTENT-X\n```\n'],
  },
  {
    name: '核心纪律 6 条全部出现在 output 中',
    files: [],
    expectedContains: [
      '1. 如需检查文件是否存在',
      '2. 创建新文件时',
      '3. 编辑文件前务必先读取',
      '4. 无论何时你需要写代码',
      '5. 遇到工具执行报错时',
      '6. 始终用中文回复',
    ],
  },
];

// ==========================================
// 测试执行器
// ==========================================
async function runTest(testCase: TestCase): Promise<boolean> {
  logger.info(`[测试] ${testCase.name}`);

  const workDir = path.join(os.tmpdir(), `node-tiny-claw-composer-${randomUUID()}`);

  try {
    for (const file of testCase.files) {
      const fullPath = path.join(workDir, file.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, file.content, 'utf-8');
    }

    const composer = new PromptComposer(workDir);
    const result = await composer.build();

    let success = true;

    if (result.role !== Role.System) {
      logger.error(`[失败] 期望 role=Role.System (${Role.System})，实际: ${result.role}`);
      success = false;
    }

    for (const expected of testCase.expectedContains ?? []) {
      if (!result.content.includes(expected)) {
        logger.error(
          `[失败] 期望 content 包含 '${expected}'，实际: ${JSON.stringify(result.content)}`
        );
        success = false;
      }
    }

    for (const unexpected of testCase.expectedNotContains ?? []) {
      if (result.content.includes(unexpected)) {
        logger.error(
          `[失败] 期望 content 不包含 '${unexpected}'，实际: ${JSON.stringify(result.content)}`
        );
        success = false;
      }
    }

    if (testCase.expectedOrder) {
      let lastIdx = -1;
      for (const str of testCase.expectedOrder) {
        const idx = result.content.indexOf(str);
        if (idx === -1) {
          logger.error(`[失败] 期望顺序断言中 '${str}' 未在 content 中出现`);
          success = false;
          break;
        }
        if (idx <= lastIdx) {
          logger.error(
            `[失败] 顺序错误: '${str}' 应在 '${testCase.expectedOrder[testCase.expectedOrder.indexOf(str) - 1] ?? '开头'}' 之后`
          );
          success = false;
          break;
        }
        lastIdx = idx;
      }
    }

    if (success) {
      logger.info(`[成功] ${testCase.name}`);
    }
    return success;
  } catch (error) {
    logger.error(`[异常] ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  }
}

// ==========================================
// 主测试运行器
// ==========================================
async function runAllTests(): Promise<void> {
  logger.info('========== PromptComposer 测试开始 ==========');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const success = await runTest(testCase);
    if (success) {
      passed++;
    } else {
      failed++;
    }
    logger.info('---');
  }

  logger.info(`========== 测试结果: ${passed} 通过, ${failed} 失败 ==========`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
