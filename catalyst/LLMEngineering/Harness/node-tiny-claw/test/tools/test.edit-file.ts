import { EditFileTool } from '../../src/tools/edit-file.ts';
import { logger } from '../../src/utils/logger.ts';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * EditFileTool 测试用例（表格驱动测试）
 */

interface TestCase {
  name: string;
  workDir: string;
  filePath?: string;
  fileContent?: string;
  args: Record<string, unknown> | string;
  expectedContains: string[];
  expectError?: boolean;
  expectedFinalContent?: string;
}

const testCases: TestCase[] = [
  // ===== L1 精确匹配 =====
  {
    name: 'L1 成功 - 唯一匹配',
    workDir: process.cwd(),
    filePath: 'edit-test-1.txt',
    fileContent: 'hello world\nfoo bar',
    args: { path: 'edit-test-1.txt', old_text: 'foo bar', new_text: 'baz qux' },
    expectedContains: ['成功修改文件'],
    expectedFinalContent: 'hello world\nbaz qux',
  },
  {
    name: 'L1 失败 - 匹配到多处',
    workDir: process.cwd(),
    filePath: 'edit-test-2.txt',
    fileContent: 'foo foo foo',
    args: { path: 'edit-test-2.txt', old_text: 'foo', new_text: 'bar' },
    expectedContains: ['Error', '匹配到了 3 处'],
    expectError: true,
  },
  {
    name: 'L1 多行内容替换',
    workDir: process.cwd(),
    filePath: 'edit-test-3.txt',
    fileContent: 'line1\nline2\nline3',
    args: { path: 'edit-test-3.txt', old_text: 'line1\nline2', new_text: 'replaced' },
    expectedContains: ['成功修改文件'],
    expectedFinalContent: 'replaced\nline3',
  },

  // ===== L2 换行符归一化 =====
  {
    name: 'L2 成功 - 原文是 CRLF，old_text 是 LF',
    workDir: process.cwd(),
    filePath: 'edit-test-crlf.txt',
    fileContent: 'alpha\r\nbeta\r\ngamma',
    args: { path: 'edit-test-crlf.txt', old_text: 'beta\ngamma', new_text: 'BETA\nGAMMA' },
    expectedContains: ['成功修改文件'],
    expectedFinalContent: 'alpha\nBETA\nGAMMA',
  },

  // ===== L3 TrimSpace =====
  {
    name: 'L3 成功 - old_text 多了首尾空行',
    workDir: process.cwd(),
    filePath: 'edit-test-trim.txt',
    fileContent: 'before\ntarget block\nafter',
    args: {
      path: 'edit-test-trim.txt',
      old_text: '\n\n  target block  \n\n',
      new_text: 'REPLACED',
    },
    expectedContains: ['成功修改文件'],
    expectedFinalContent: 'before\nREPLACED\nafter',
  },

  // ===== L4 逐行去缩进 =====
  {
    name: 'L4 成功 - old_text 缩进错位（接受 newText 缩进与上下文不一致的格式损失）',
    workDir: process.cwd(),
    filePath: 'edit-test-indent.txt',
    fileContent: 'function f() {\n    if (x) {\n        doIt();\n    }\n}',
    args: {
      path: 'edit-test-indent.txt',
      old_text: 'if (x) {\n  doIt();\n}',
      new_text: 'if (y) {\n    doIt();\n}',
    },
    expectedContains: ['成功修改文件'],
    // L4 把 newText 整体插入匹配行范围，原本的 4 空格缩进上下文不会恢复
    expectedFinalContent: 'function f() {\nif (y) {\n    doIt();\n}\n}',
  },
  {
    name: 'L4 失败 - 模糊匹配到多处（构造让 L1/L2/L3 都漏过、L4 才命中的输入）',
    workDir: process.cwd(),
    filePath: 'edit-test-multi.txt',
    fileContent: '  doit();\n  doit();\n  doit();',
    // 旧文本带前导 \n 防止 L1/L3 整词命中，但 L4 按行 trim 后会匹配到 3 处
    args: { path: 'edit-test-multi.txt', old_text: '\ndoit();', new_text: 'CHANGED();' },
    expectedContains: ['Error', '模糊匹配到了 3 处'],
    expectError: true,
  },
  {
    name: 'L4 失败 - 行数超过文件',
    workDir: process.cwd(),
    filePath: 'edit-test-short.txt',
    fileContent: 'short',
    args: { path: 'edit-test-short.txt', old_text: 'line1\nline2\nline3', new_text: 'x' },
    expectedContains: ['Error', '找不到该代码片段'],
    expectError: true,
  },
  {
    name: 'L4 失败 - 全部算法都未命中',
    workDir: process.cwd(),
    filePath: 'edit-test-miss.txt',
    fileContent: 'hello world',
    args: { path: 'edit-test-miss.txt', old_text: 'completely different', new_text: 'x' },
    expectedContains: ['Error', '未找到 old_text'],
    expectError: true,
  },

  // ===== 字符串参数解析 =====
  {
    name: '字符串形式的 args 解析成功',
    workDir: process.cwd(),
    filePath: 'edit-test-10.txt',
    fileContent: 'one two three',
    args: JSON.stringify({ path: 'edit-test-10.txt', old_text: 'two', new_text: '2' }),
    expectedContains: ['成功修改文件'],
    expectedFinalContent: 'one 2 three',
  },

  // ===== 文件 IO 错误 =====
  {
    name: '文件不存在',
    workDir: process.cwd(),
    args: { path: 'no-such-edit-file-xyz.txt', old_text: 'a', new_text: 'b' },
    expectedContains: ['Error', '不存在'],
    expectError: true,
  },
  {
    name: '路径穿越检测',
    workDir: process.cwd(),
    args: { path: '../escape.txt', old_text: 'a', new_text: 'b' },
    expectedContains: ['Error', '超出工作区范围'],
    expectError: true,
  },

  // ===== 参数解析错误 =====
  {
    name: '缺少 path',
    workDir: process.cwd(),
    args: { old_text: 'a', new_text: 'b' },
    expectedContains: ['参数解析失败', '缺少必需参数'],
    expectError: true,
  },
  {
    name: '缺少 old_text',
    workDir: process.cwd(),
    args: { path: 'x.txt', new_text: 'b' },
    expectedContains: ['参数解析失败', '缺少必需参数'],
    expectError: true,
  },
  {
    name: '缺少 new_text',
    workDir: process.cwd(),
    args: { path: 'x.txt', old_text: 'a' },
    expectedContains: ['参数解析失败', '缺少必需参数'],
    expectError: true,
  },
  {
    name: '无效 JSON',
    workDir: process.cwd(),
    args: 'not-valid-json{',
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
      await fs.unlink(file);
    } catch {
      // 忽略
    }
  }
  testFiles.length = 0;
}

// ==========================================
// 测试执行器
// ==========================================
async function runTest(testCase: TestCase): Promise<boolean> {
  logger.info(`[测试] ${testCase.name}`);

  if (testCase.filePath && testCase.fileContent !== undefined) {
    const fullPath = path.join(testCase.workDir, testCase.filePath);
    await fs.writeFile(fullPath, testCase.fileContent, 'utf-8');
    testFiles.push(fullPath);
  }

  const tool = new EditFileTool(testCase.workDir);
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

  if (success && testCase.expectedFinalContent && testCase.filePath) {
    const fullPath = path.join(testCase.workDir, testCase.filePath);
    try {
      const actual = await fs.readFile(fullPath, 'utf-8');
      if (actual !== testCase.expectedFinalContent) {
        logger.error(
          `[失败] 文件内容不匹配，期望: ${JSON.stringify(testCase.expectedFinalContent)}，实际: ${JSON.stringify(actual)}`
        );
        success = false;
      } else {
        logger.info(`[验证] 文件内容正确: ${actual.substring(0, 50)}...`);
      }
    } catch (e) {
      logger.error(`[失败] 读取文件验证失败: ${e instanceof Error ? e.message : String(e)}`);
      success = false;
    }
  }

  if (success) logger.info(`[成功] ${result}`);
  return success;
}

// ==========================================
// 主测试运行器
// ==========================================
async function runAllTests(): Promise<void> {
  logger.info('========== EditFileTool 测试开始 ==========');
  let passed = 0;
  let failed = 0;

  try {
    for (const testCase of testCases) {
      try {
        const success = await runTest(testCase);
        if (success) passed++;
        else failed++;
      } catch (error) {
        logger.error(`[异常] ${error instanceof Error ? error.message : String(error)}`);
        failed++;
      }
      logger.info('---');
    }
  } finally {
    await cleanupTestFiles();
  }

  logger.info(`========== 测试结果: ${passed} 通过, ${failed} 失败 ==========`);
  if (failed > 0) process.exit(1);
}

runAllTests();
