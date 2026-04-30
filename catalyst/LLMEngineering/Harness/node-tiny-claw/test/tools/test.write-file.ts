import { WriteFileTool } from '../../src/tools/write-file.ts';
import { logger } from '../../src/utils/logger.ts';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * WriteFileTool 测试用例（表格驱动测试）
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
    name: '写入普通文本文件',
    workDir: process.cwd(),
    args: { path: 'test-output.txt', content: 'Hello, WriteFileTool!' },
    expectedContains: ['成功将内容写入到文件'],
    expectError: false,
  },
  {
    name: '创建嵌套目录并写入文件',
    workDir: process.cwd(),
    args: { path: 'test-dir/nested/test.txt', content: 'Nested file content' },
    expectedContains: ['成功将内容写入到文件'],
    expectError: false,
  },
  {
    name: '覆盖已存在的文件',
    workDir: process.cwd(),
    args: { path: 'test-output.txt', content: 'Updated content' },
    expectedContains: ['成功将内容写入到文件'],
    expectError: false,
  },
  {
    name: '写入 JSON 格式内容',
    workDir: process.cwd(),
    args: { path: 'test.json', content: '{"name": "test", "value": 123}' },
    expectedContains: ['成功将内容写入到文件', '.json'],
    expectError: false,
  },
  {
    name: '写入多行文本',
    workDir: process.cwd(),
    args: { path: 'test-multiline.txt', content: '第一行\n第二行\n第三行' },
    expectedContains: ['成功将内容写入到文件'],
    expectError: false,
  },
  {
    name: '缺少 path 参数',
    workDir: process.cwd(),
    args: { content: 'some content' },
    expectedContains: ['参数解析失败'],
    expectError: true,
  },
  {
    name: '缺少 content 参数',
    workDir: process.cwd(),
    args: { path: 'test.txt' },
    expectedContains: ['参数解析失败'],
    expectError: true,
  },
];

// ==========================================
// 测试文件清理
// ==========================================
const testFiles: string[] = [];

async function cleanupTestFiles(): Promise<void> {
  for (const file of testFiles) {
    try {
      await fs.rm(file, { force: true });
    } catch {
      // 忽略清理错误
    }
  }
  // 清理测试目录
  try {
    await fs.rm(path.join(process.cwd(), 'test-dir'), { recursive: true, force: true });
  } catch {
    // 忽略
  }
  testFiles.length = 0;
}

// ==========================================
// 测试执行器
// ==========================================
async function runTest(testCase: TestCase): Promise<boolean> {
  logger.info(`[测试] ${testCase.name}`);

  const tool = new WriteFileTool(testCase.workDir);
  const result = await tool.execute(testCase.args);

  let success = true;

  for (const expected of testCase.expectedContains) {
    if (!result.includes(expected)) {
      logger.error(`[失败] 期望结果包含 '${expected}'，实际结果: ${result}`);
      success = false;
    }
  }

  if (testCase.expectError && !result.startsWith('Error:') && !result.includes('参数解析失败')) {
    logger.error(`[失败] 期望有错误返回，实际结果: ${result}`);
    success = false;
  }

  if (success) {
    logger.info(`[成功] ${result}`);

    // 验证文件确实被创建（对于非错误测试）
    if (!testCase.expectError && testCase.args.path) {
      const fullPath = path.join(testCase.workDir, testCase.args.path as string);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        if (content === testCase.args.content) {
          logger.info(`[验证] 文件内容正确: ${content.substring(0, 50)}...`);
        } else {
          logger.error(`[失败] 文件内容不匹配，期望: ${testCase.args.content}，实际: ${content}`);
          success = false;
        }
        testFiles.push(fullPath);
      } catch {
        logger.error(`[失败] 文件未被创建: ${fullPath}`);
        success = false;
      }
    }
  }

  return success;
}

// ==========================================
// 主测试运行器
// ==========================================
async function runAllTests(): Promise<void> {
  logger.info('========== WriteFileTool 测试开始 ==========');

  let passed = 0;
  let failed = 0;

  try {
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
  } finally {
    // 清理测试文件
    await cleanupTestFiles();
  }

  logger.info(`========== 测试结果: ${passed} 通过, ${failed} 失败 ==========`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();