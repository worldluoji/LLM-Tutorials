import { SkillLoader } from '../../src/context/skill.ts';
import { logger } from '../../src/utils/logger.ts';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

/**
 * SkillLoader 测试用例（表格驱动测试）
 */

interface FileSpec {
  /** 相对 workDir 的文件路径（含 .claw/skills/...） */
  path: string;
  content: string;
}

interface TestCase {
  name: string;
  files: FileSpec[];
  expectedContains?: string[];
  expectedNotContains?: string[];
  /** 当为 true 时，断言 loadAll() 返回严格等于 "" */
  expectedEmpty?: boolean;
}

const testCases: TestCase[] = [
  {
    name: '有效 Frontmatter - 完整字段',
    files: [
      {
        path: '.claw/skills/git-commit/SKILL.md',
        content:
          '---\n' +
          'name: Git Commit Conventions\n' +
          'description: 当用户要求提交代码时遵循 Conventional Commits 规范\n' +
          '---\n' +
          '\n' +
          '使用 pnpm commit 或手动 git commit -m "type(scope): subject"。\n',
      },
    ],
    expectedContains: [
      '### 可用专业技能 (Agent Skills)',
      '技能名称: Git Commit Conventions',
      '**触发条件**: 当用户要求提交代码时遵循 Conventional Commits 规范',
      '**执行指南**:',
      '使用 pnpm commit',
    ],
  },
  {
    name: '完全无 Frontmatter - 走默认值',
    files: [
      {
        path: '.claw/skills/no-fm/SKILL.md',
        content: '这是没有任何 Frontmatter 的技能正文。\n仅包含执行指令。\n',
      },
    ],
    expectedContains: [
      '技能名称: Unknown Skill',
      '**触发条件**: No description provided.',
      '这是没有任何 Frontmatter 的技能正文。',
      '仅包含执行指令。',
    ],
  },
  {
    name: '缺 description 字段 - 走默认值',
    files: [
      {
        path: '.claw/skills/no-desc/SKILL.md',
        content:
          '---\n' +
          'name: Only Name Skill\n' +
          '---\n' +
          '\n' +
          'This skill only has a name.\n',
      },
    ],
    expectedContains: [
      '技能名称: Only Name Skill',
      '**触发条件**: No description provided.',
      'This skill only has a name.',
    ],
  },
  {
    name: '子目录递归扫描',
    files: [
      {
        path: '.claw/skills/sub/inner/SKILL.md',
        content:
          '---\n' +
          'name: Deep Skill\n' +
          'description: A skill in a nested directory\n' +
          '---\n' +
          '\n' +
          'Deep body.\n',
      },
    ],
    expectedContains: [
      '技能名称: Deep Skill',
      '**触发条件**: A skill in a nested directory',
      'Deep body.',
    ],
  },
  {
    name: '非 SKILL.md 文件被忽略',
    files: [
      {
        path: '.claw/skills/README.md',
        content: '# This should not be loaded as a skill',
      },
      {
        path: '.claw/skills/notes.txt',
        content: 'Random text file that should be skipped',
      },
      {
        path: '.claw/skills/valid/SKILL.md',
        content:
          '---\n' +
          'name: Only Valid One\n' +
          'description: Only the valid skill should appear\n' +
          '---\n' +
          '\n' +
          'Valid body.\n',
      },
    ],
    expectedContains: [
      '技能名称: Only Valid One',
      '**触发条件**: Only the valid skill should appear',
      'Valid body.',
    ],
    expectedNotContains: [
      'This should not be loaded',
      'Random text file that should be skipped',
    ],
  },
  {
    name: '目录存在但无 SKILL.md - 返回空串',
    files: [
      {
        path: '.claw/skills/random.txt',
        content: 'just a text file',
      },
    ],
    expectedEmpty: true,
  },
  {
    name: '.claw/skills 目录不存在 - 返回空串',
    files: [],
    expectedEmpty: true,
  },
  {
    name: 'name 字段含多余冒号 - 正确切分',
    files: [
      {
        path: '.claw/skills/colons/SKILL.md',
        content:
          '---\n' +
          'name: My: Cool: Skill\n' +
          'description: A name with colons in it\n' +
          '---\n' +
          '\n' +
          'Body.\n',
      },
    ],
    expectedContains: [
      '技能名称: My: Cool: Skill',
      '**触发条件**: A name with colons in it',
    ],
  },
  {
    name: 'Frontmatter 不闭合 - 安全降级为整段正文',
    files: [
      {
        path: '.claw/skills/broken/SKILL.md',
        content:
          '---\n' +
          'name: Malformed\n' +
          'description: This file has no closing fence\n' +
          '正文直接开始于 frontmatter 之后。\n',
      },
    ],
    expectedContains: [
      '技能名称: Unknown Skill',
      '**触发条件**: No description provided.',
      '正文直接开始于 frontmatter 之后。',
    ],
    expectedNotContains: ['技能名称: Malformed'],
  },
  {
    name: 'CRLF 换行符 - 跨平台兼容',
    files: [
      {
        path: '.claw/skills/crlf/SKILL.md',
        content:
          '---\r\n' +
          'name: CRLF Skill\r\n' +
          'description: Tests CRLF line endings\r\n' +
          '---\r\n' +
          '\r\n' +
          'Body with CRLF.\r\n',
      },
    ],
    expectedContains: [
      '技能名称: CRLF Skill',
      '**触发条件**: Tests CRLF line endings',
      'Body with CRLF.',
    ],
  },
];

// ==========================================
// 测试执行器
// ==========================================
async function runTest(testCase: TestCase): Promise<boolean> {
  logger.info(`[测试] ${testCase.name}`);

  const workDir = path.join(os.tmpdir(), `node-tiny-claw-skill-${randomUUID()}`);

  try {
    for (const file of testCase.files) {
      const fullPath = path.join(workDir, file.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, file.content, 'utf-8');
    }

    const loader = new SkillLoader(workDir);
    const result = await loader.loadAll();

    let success = true;

    if (testCase.expectedEmpty) {
      if (result !== '') {
        logger.error(`[失败] 期望空字符串，实际: ${JSON.stringify(result)}`);
        success = false;
      }
    } else {
      for (const expected of testCase.expectedContains ?? []) {
        if (!result.includes(expected)) {
          logger.error(
            `[失败] 期望结果包含 '${expected}'，实际: ${JSON.stringify(result)}`
          );
          success = false;
        }
      }
      for (const unexpected of testCase.expectedNotContains ?? []) {
        if (result.includes(unexpected)) {
          logger.error(
            `[失败] 期望结果不包含 '${unexpected}'，实际: ${JSON.stringify(result)}`
          );
          success = false;
        }
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
  logger.info('========== SkillLoader 测试开始 ==========');

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
