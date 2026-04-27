/**
 * test.read-file-tool.ts
 *
 * 测试 ReadFileTool 通过 Registry 注册后，
 * 与 MiniMax 大模型集成，实现真正的工具调用
 */
import { MiniMaxProvider } from '../../src/llm/minimax-provider.ts';
import { RegistryImpl } from '../../src/tools/registry.ts';
import { ReadFileTool } from '../../src/tools/read-file.ts';
import { Message, Role } from '../../src/schema/message.ts';
import { logger } from '../../src/utils/logger.ts';

/**
 * 主测试运行器
 */
async function runTest(): Promise<boolean> {
  logger.info('[测试] 调用 read_file 工具读取 hello.txt');

  // 1. 初始化 MiniMax Provider
  const provider = new MiniMaxProvider();

  // 2. 初始化 Registry 并注册 ReadFileTool
  const registry = new RegistryImpl();
  const workDir = process.cwd();
  registry.register(new ReadFileTool(workDir));
  logger.info(`[Registry] 工作目录: ${workDir}`);

  // 3. 构建消息上下文
  const messages: Message[] = [
    {
      role: Role.System,
      content: 'You are node-tiny-claw, an expert coding assistant. You have full access to tools in the workspace.',
    },
    {
      role: Role.User,
      content: '请调用工具读取一下当前工作区目录下 hello.txt 文件的内容，并用一句话向我总结它说了什么。',
    },
  ];

  // 4. 获取可用工具
  const availableTools = registry.getAvailableTools();
  logger.info(`[Registry] 可用工具: ${availableTools.map((t) => t.name).join(', ')}`);

  // 5. 调用大模型
  logger.info('[MiniMax] 发送请求...');
  const response = await provider.generate(messages, availableTools);
  logger.info(`[MiniMax] 响应: ${response.content || '(无文本内容)'}`);

  // 6. 验证结果
  if (!response.tool_calls || response.tool_calls.length === 0) {
    logger.error('[失败] 期望有工具调用，但返回为空');
    return false;
  }

  const hasReadFile = response.tool_calls.some((tc) => tc.name === 'read_file');
  if (!hasReadFile) {
    logger.error('[失败] 期望调用 read_file 工具');
    return false;
  }
  logger.info(`[成功] 模型正确调用了 read_file 工具`);

  // 7. 执行工具
  for (const toolCall of response.tool_calls) {
    logger.info(`[Registry] 执行工具: ${toolCall.name}, 参数: ${JSON.stringify(toolCall.arguments)}`);
    const result = await registry.execute(toolCall);
    logger.info(`[Registry] 工具执行结果: ${result.output.substring(0, 100)}...`);
    logger.info(`[Registry] 是否错误: ${result.is_error}`);

    // 将工具执行结果添加到消息上下文
    messages.push(response);
    messages.push({
      role: Role.User,
      content: result.output,
      tool_call_id: toolCall.id,
    });
  }

  // 8. 第二次调用：让模型基于工具结果回复用户
  logger.info('[MiniMax] 第二次调用，让模型总结工具结果...');
  const followUpResponse = await provider.generate(messages, availableTools);
  logger.info(`[MiniMax] 总结回复: ${followUpResponse.content}`);

  return true;
}

async function main(): Promise<void> {
  logger.info('========== ReadFileTool + Registry + MiniMax 集成测试 ==========');

  try {
    const success = await runTest();
    if (success) {
      logger.info('========== 测试通过 ==========');
    } else {
      logger.error('========== 测试失败 ==========');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`[异常] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
