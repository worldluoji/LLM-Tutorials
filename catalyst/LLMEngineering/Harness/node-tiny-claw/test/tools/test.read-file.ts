import { ReadFileTool } from '../../src/tools/read-file.ts';
import { logger } from '../../src/utils/logger.ts';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * ReadFileTool 测试用例（表格驱动测试）
 */

// ==========================================
// 测试用例表格
// ==========================================
interface TestCase {
  name: string;
  workDir: string;
  filePath?: string;
  fileContent?: string;
  args: Record<string, unknown>;
  expectedContains: string[];
  expectError?: boolean;
}

const testCases: TestCase[] = [
  {
    name: '读取存在的文件 - 正常内容',
    workDir: process.cwd(),
    filePath: 'test-file.txt',
    fileContent: 'Hello, World!',
    args: { path: 'test-file.txt' },
    expectedContains: ['Hello, World!'],
    expectError: false,
  },
  {
    name: '读取存在的文件 - 多行内容',
    workDir: process.cwd(),
    filePath: 'multi-line.txt',
    fileContent: '第一行\n第二行\n第三行',
    args: { path: 'multi-line.txt' },
    expectedContains: ['第一行', '第二行', '第三行'],
    expectError: false,
  },
  {
    name: '读取不存在的文件',
    workDir: process.cwd(),
    args: { path: 'non-existent-file.txt' },
    expectedContains: ['Error', '不存在'],
    expectError: true,
  },
  {
    name: '缺少 path 参数',
    workDir: process.cwd(),
    args: {},
    expectedContains: ['参数解析失败', '缺少必需参数'],
    expectError: false, // 返回的错误消息不以 "Error:" 开头
  },
  {
    name: '路径穿越攻击检测',
    workDir: process.cwd(),
    args: { path: '../../etc/passwd' },
    expectedContains: ['Error', '超出工作区范围'],
    expectError: true,
  },
  {
    name: '读取 JSON 格式文件',
    workDir: process.cwd(),
    filePath: 'test.json',
    fileContent: '{"name": "test", "value": 123}',
    args: { path: 'test.json' },
    expectedContains: ['"name"', '"test"', '"value"', '123'],
    expectError: false,
  },
];

// ==========================================
// 测试准备与清理
// ==========================================
const testFiles: string[] = [];

async function setupTestFile(filePath: string, content: string): Promise<void> {
  const fullPath = path.join(process.cwd(), filePath);
  await fs.writeFile(fullPath, content, 'utf-8');
  testFiles.push(fullPath);
}

async function cleanupTestFiles(): Promise<void> {
  for (const file of testFiles) {
    try {
      await fs.unlink(file);
    } catch {
      // 忽略清理错误
    }
  }
  testFiles.length = 0;
}

// ==========================================
// 测试执行器
// ==========================================
async function runTest(testCase: TestCase): Promise<boolean> {
  logger.info(`[测试] ${testCase.name}`);

  // 准备测试文件
  if (testCase.filePath && testCase.fileContent) {
    await setupTestFile(testCase.filePath, testCase.fileContent);
  }

  const tool = new ReadFileTool(testCase.workDir);
  const result = await tool.execute(testCase.args);

  let success = true;

  for (const expected of testCase.expectedContains) {
    if (!result.includes(expected)) {
      logger.error(`[失败] 期望结果包含 '${expected}'，实际结果: ${result}`);
      success = false;
    }
  }

  if (testCase.expectError && !result.startsWith('Error:')) {
    logger.error(`[失败] 期望有错误返回，实际结果: ${result}`);
    success = false;
  }

  if (success) {
    logger.info(`[成功] ${result}`);
  }

  return success;
}

// ==========================================
// 主测试运行器
// ==========================================
async function runAllTests(): Promise<void> {
  logger.info('========== ReadFileTool 测试开始 ==========');

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

  // 清理测试文件
  await cleanupTestFiles();

  logger.info(`========== 测试结果: ${passed} 通过, ${failed} 失败 ==========`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
