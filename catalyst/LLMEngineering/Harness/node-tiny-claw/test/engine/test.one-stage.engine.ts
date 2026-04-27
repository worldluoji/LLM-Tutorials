// ==========================================
// 直接从项目内部模块导入已有的定义
// （请根据实际文件路径调整 import 语句）
// ==========================================
import { AgentEngine } from '../../src/engine/loop.ts'; // 核心引擎类
import {
  Message,
  Role,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from '../../src/schema/message.ts'; // 类型定义
import { LLMProvider } from '../../src/llm/llm-provider.ts';
import { logger } from '../../src/utils/logger.ts';
// 注意：由于是 Mock，我们并不需要真实 Provider 基类，只需实现其接口即可

// ==========================================
// 1. 伪造的大模型 Provider（实现 provider 接口）
// ==========================================
class MockProvider implements LLMProvider {
  private turn = 0;

  // 必须与内部 provider 定义的 generate 方法签名一致
  async generate(
    _msgs: Message[],
    _availableTools: ToolDefinition[],
    _signal?: AbortSignal
  ): Promise<Message> {
    this.turn++;

    if (this.turn === 1) {
      return {
        role: Role.Assistant,
        content: '让我来看看当前目录下有什么文件。',
        tool_calls: [
          {
            id: 'call_123',
            name: 'bash',
            arguments: { command: 'ls -la' },
          },
        ],
      } as Message;
    }

    return {
      role: Role.Assistant,
      content: '我看到了文件列表，里面包含 main.ts，任务完成！',
    } as Message;
  }
}

// ==========================================
// 2. 伪造的 Tool Registry（实现 tools 包定义的接口）
// ==========================================
import { BaseTool } from '../../src/tools/registry.ts';

class MockRegistry {
  getAvailableTools(): ToolDefinition[] {
    return [];
  }

  async execute(call: ToolCall, _signal?: AbortSignal): Promise<ToolResult> {
    return {
      tool_call_id: call.id,
      output: '-rw-r--r--  1 user group  234 Oct 24 10:00 test.engine.ts\n',
      is_error: false,
    } as ToolResult;
  }

  register(_tool: BaseTool): void {
    // Mock implementation: do nothing
  }
}

// ==========================================
// 3. 运行测试
// ==========================================
async function runTest() {
  const workDir = process.cwd();

  // 直接实例化项目中的 AgentEngine，传入 Mock 实现
  const engine = new AgentEngine(
    new MockProvider(),
    new MockRegistry(),
    workDir,
    false
  );

  try {
    await engine.run('帮我检查当前目录的文件');
    logger.info('测试完成');
  } catch (error) {
    logger.error(`引擎崩溃: ${error}`);
    process.exit(1);
  }
}

runTest();