import { Message, Role, ToolDefinition } from '../schema/message.ts';
import { LLMProvider } from './llm-provider.ts';
import { logger } from '../utils/logger.ts';

type AbortSignal = globalThis.AbortSignal;

/**
 * MiniMax Provider - 实现 LLMProvider 接口
 * MiniMax API 采用 OpenAI 兼容格式
 */
export class MiniMaxProvider implements LLMProvider {
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor(model: string = 'MiniMax-M2.7') {
    this.apiKey = process.env.MINIMAX_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('请设置 MINIMAX_API_KEY 环境变量');
    }
    this.baseURL = 'https://api.minimax.chat/v1';
    this.model = model;
  }

  async generate(
    messages: Message[],
    availableTools: ToolDefinition[],
    signal?: AbortSignal
  ): Promise<Message> {
    // 1. 消息翻译：将内部 Message 转换为 MiniMax API 格式
    const miniMaxMessages = this.translateMessages(messages);

    // 2. 工具 Schema 翻译
    const miniMaxTools = this.translateTools(availableTools);

    // 3. 构建请求
    const requestBody: Record<string, unknown> = {
      model: this.model,
      messages: miniMaxMessages,
    };

    if (miniMaxTools.length > 0) {
      requestBody.tools = miniMaxTools;
    }

    logger.info(`[MiniMax] 发送请求到 ${this.baseURL}/chat/completions`);
    logger.debug(`[MiniMax] 请求体: ${JSON.stringify(requestBody, null, 2)}`);

    // 4. 发送请求
    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求被取消', { cause: error });
      }
      throw error;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MiniMax API 请求失败: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          role: string;
          content: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    logger.debug(`[MiniMax] 响应体: ${JSON.stringify(data, null, 2)}`);

    // 5. 反向解析：将 MiniMax 响应转换为内部 Message
    return this.parseResponse(data);
  }

  private translateMessages(messages: Message[]): Array<Record<string, unknown>> {
    const result: Array<Record<string, unknown>> = [];

    for (const msg of messages) {
      switch (msg.role) {
        case Role.System: {
          result.push({ role: 'system', content: msg.content });
          break;
        }
        case Role.User: {
          if (msg.tool_call_id) {
            // MiniMax API 要求工具结果消息使用 tool role
            result.push({
              role: 'tool',
              content: msg.content || '',
              tool_call_id: msg.tool_call_id,
            });
          } else {
            result.push({ role: 'user', content: msg.content });
          }
          break;
        }
        case Role.Assistant: {
          const assistantMsg: Record<string, unknown> = { role: 'assistant' };
          if (msg.content) {
            assistantMsg.content = msg.content;
          }
          if (msg.tool_calls && msg.tool_calls.length > 0) {
            assistantMsg.tool_calls = msg.tool_calls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments:
                  typeof tc.arguments === 'string'
                    ? tc.arguments
                    : JSON.stringify(tc.arguments),
              },
            }));
          }
          result.push(assistantMsg);
          break;
        }
      }
    }

    return result;
  }

  private translateTools(
    tools: ToolDefinition[]
  ): Array<{ type: string; function: Record<string, unknown> }> {
    if (tools.length === 0) return [];

    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  private parseResponse(
    data: {
      choices: Array<{
        message: {
          role: string;
          content: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    }
  ): Message {
    const choice = data.choices[0];
    if (!choice) {
      throw new Error('MiniMax API 返回为空');
    }

    const resultMsg: Message = {
      role: Role.Assistant,
      content: choice.message.content || '',
    };

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      resultMsg.tool_calls = choice.message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));
    }

    return resultMsg;
  }
}
