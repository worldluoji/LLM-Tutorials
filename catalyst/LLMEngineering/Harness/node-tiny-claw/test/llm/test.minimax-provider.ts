import { Message, Role } from '../../src/schema/message.ts';
import { MiniMaxProvider } from '../../src/llm/minimax-provider.ts';
import { logger } from '../../src/utils/logger.ts';

/**
 * MiniMaxProvider 测试用例（表格驱动测试）
 */

// ==========================================
// 测试用例表格
// ==========================================
interface TestCase {
  name: string;
  model: string;
  messages: Message[];
  expectContent?: boolean;
  expectToolCalls?: boolean;
}

const testCases: TestCase[] = [
  {
    name: '简单对话 - 模型回复纯文本',
    model: process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
    messages: [
      { role: Role.System, content: '你是一个友好的助手。' },
      { role: Role.User, content: '你好，请介绍一下你自己。' },
    ],
    expectContent: true,
    expectToolCalls: false,
  },
  {
    name: '工具调用场景 - 请求列出目录文件',
    model: process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
    messages: [
      {
        role: Role.System,
        content: 'You are node-tiny-claw, an expert coding assistant.',
      },
      {
        role: Role.User,
        content: '请列出当前目录的所有文件。',
      },
    ],
    expectContent: false,
    expectToolCalls: true,
  },
  {
    name: '多轮对话上下文',
    model: process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
    messages: [
      { role: Role.System, content: '你是一个乐于助人的助手。' },
      { role: Role.User, content: '北京是哪个国家的首都？' },
      { role: Role.Assistant, content: '北京是中华人民共和国的首都。' },
      { role: Role.User, content: '那里有什么著名的建筑？' },
    ],
    expectContent: true,
    expectToolCalls: false,
  },
];

// ==========================================
// 测试执行器
// ==========================================
async function runTest(testCase: TestCase): Promise<boolean> {
  logger.info(`[测试] ${testCase.name}`);

  const provider = new MiniMaxProvider(testCase.model);

  try {
    const result = await provider.generate(testCase.messages, []);

    // 验证响应
    if (testCase.expectContent && !result.content) {
      logger.error(`[失败] 期望有内容，但返回为空`);
      return false;
    }

    if (testCase.expectToolCalls && (!result.tool_calls || result.tool_calls.length === 0)) {
      logger.error(`[失败] 期望有工具调用，但返回为空`);
      return false;
    }

    logger.info(`[成功] 模型回复: ${result.content || '(无文本内容)'}`);
    if (result.tool_calls && result.tool_calls.length > 0) {
      logger.info(`[成功] 工具调用: ${JSON.stringify(result.tool_calls)}`);
    }

    return true;
  } catch (error) {
    logger.error(`[异常] ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// ==========================================
// 主测试运行器
// ==========================================
async function runAllTests(): Promise<void> {
  logger.info('========== MiniMaxProvider 测试开始 ==========');

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
