import { BashTool } from '../../src/tools/bash.ts';
import { logger } from '../../src/utils/logger.ts';

/**
 * BashTool 测试用例（表格驱动测试）
 */

// ==========================================
// 测试用例表格
// ==========================================
interface TestCase {
  name: string;
  workDir: string;
  args: Record<string, unknown>;
  expectedContains: string[];
  expectError?: boolean;
}

const testCases: TestCase[] = [
  {
    name: '执行 ls 命令 - 列出目录内容',
    workDir: process.cwd(),
    args: { command: 'ls -la' },
    expectedContains: ['test', 'src', 'node_modules'],
    expectError: false,
  },
  {
    name: '执行 pwd 命令 - 显示当前目录',
    workDir: process.cwd(),
    args: { command: 'pwd' },
    expectedContains: ['node-tiny-claw'],
    expectError: false,
  },
  {
    name: '执行 echo 命令 - 输出文本',
    workDir: process.cwd(),
    args: { command: 'echo "Hello from BashTool"' },
    expectedContains: ['Hello from BashTool'],
    expectError: false,
  },
  {
    name: '执行链式命令 - 使用 &&',
    workDir: process.cwd(),
    args: { command: 'echo "first" && echo "second"' },
    expectedContains: ['first', 'second'],
    expectError: false,
  },
  {
    name: '执行不存在的命令',
    workDir: process.cwd(),
    args: { command: 'nonexistent_command_12345' },
    expectedContains: ['执行报错', 'not found'],
    expectError: true,
  },
  {
    name: '缺少 command 参数',
    workDir: process.cwd(),
    args: {},
    expectedContains: ['参数解析失败'],
    expectError: true,
  },
  {
    name: '执行 grep 查找文件',
    workDir: process.cwd(),
    args: { command: 'grep -r "BashTool" src/' },
    expectedContains: ['bash.ts'],
    expectError: false,
  },
];

// ==========================================
// 测试执行器
// ==========================================
async function runTest(testCase: TestCase): Promise<boolean> {
  logger.info(`[测试] ${testCase.name}`);

  const tool = new BashTool(testCase.workDir);
  const result = await tool.execute(testCase.args);

  let success = true;

  for (const expected of testCase.expectedContains) {
    if (!result.includes(expected)) {
      logger.error(`[失败] 期望结果包含 '${expected}'，实际结果: ${result}`);
      success = false;
    }
  }

  if (testCase.expectError && !result.includes('执行报错') && !result.includes('参数解析失败')) {
    logger.error(`[失败] 期望有错误返回，实际结果: ${result}`);
    success = false;
  }

  if (success) {
    logger.info(`[成功] ${result.substring(0, 100)}...`);
  }

  return success;
}

// ==========================================
// 主测试运行器
// ==========================================
async function runAllTests(): Promise<void> {
  logger.info('========== BashTool 测试开始 ==========');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const success = await runTest(testCase);
      if (success) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      logger.error(`[异常] ${error instanceof Error ? error.message : String(error)}`);
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