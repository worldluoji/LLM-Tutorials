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
import { Session } from '../../src/engine/session.ts';
import { logger } from '../../src/utils/logger.ts';
// 注意：由于是 Mock，我们并不需要真实 Provider 基类，只需实现其接口即可

// ==========================================
// 1. 伪造的大模型 Provider（实现 provider 接口）
// ==========================================
class MockProvider implements LLMProvider {
  private callCount = 0;

  // 必须与内部 provider 定义的 generate 方法签名一致
  async generate(
    _msgs: Message[],
    availableTools: ToolDefinition[],
    _signal?: AbortSignal
  ): Promise<Message> {
    this.callCount++;

    // Phase 1 (Thinking): 无工具，强制思考
    if (availableTools.length === 0) {
      return {
        role: Role.Assistant,
        content: '让我先思考一下这个问题。我需要先查看当前目录下有什么文件，了解项目结构后再决定下一步行动。',
      } as Message;
    }

    // Phase 2 (Action): 有工具，恢复行动
    // 第一次 Action 调用返回工具调用，第二次返回最终回复
    if (this.callCount === 2) {
      // 这是思考后的第一次 Action
      return {
        role: Role.Assistant,
        content: '让我来看看当前目录下有什么文件。',
        tool_calls: [
          {
            id: 'call_1',
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
    // 返回一个模拟的工具定义
    return [
      {
        name: 'bash',
        description: 'Execute a bash command',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The bash command to execute' },
          },
          required: ['command'],
        },
      },
    ] as ToolDefinition[];
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

  // 直接实例化项目中的 AgentEngine，传入 Mock 实现，启用慢思考模式
  const engine = new AgentEngine(
    new MockProvider(),
    new MockRegistry(),
    workDir,
    true // 启用 Two-Stage ReAct 慢思考模式
  );
  const session = new Session('two-stage-test', workDir);

  try {
    await engine.run(session, '帮我检查当前目录的文件');
    logger.info('测试完成');
  } catch (error) {
    logger.error(`引擎崩溃: ${error}`);
    process.exit(1);
  }
}

runTest();