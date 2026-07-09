import { Message, Role, ToolCall, ToolDefinition } from '../schema/message.ts';
import { LLMProvider } from './llm-provider.ts';
import { logger } from '../utils/logger.ts';

type AbortSignal = globalThis.AbortSignal;

/**
 * 兜底正则：捕捉模型偶尔把工具调用塞进 content 文本时的格式。
 * 实际观察到至少两种变体：
 *   A. Qwen/Hermes 风格：
 *     <tool_call>
 *     invoke
 *     {"name": "bash", "arguments": {"command": "..."}}
 *    </tool_call>
 *   B. 简化风格（无 invoke 关键字）：
 *     <tool_call>
 *     {"name": "write_file", "arguments": {"path": "..."}}
 *    </tool_call>
 *
 * 正则把 `invoke` 设为可选子组，匹配以上两种格式。解析后转成结构化 ToolCall 数组，
 * 让 Main Loop 正常派发。
 */
const TEXT_TOOL_CALL_RE = /<tool_call>\s*(?:invoke\s*)?(\{[\s\S]*?\})\s*<\/tool_call>/g;

/**
 * 把 content 文本里散落的 tool_call 块提取成结构化 ToolCall 数组。
 * - 解析失败的块静默跳过
 * - arguments 统一序列化为字符串（与 OpenAI 兼容格式对齐）
 * - ID 形如 `text_call_<idx>`，便于日志追溯"这是文本兜底路径"
 */
export function parseTextToolCalls(content: string): ToolCall[] {
  if (!content) return [];
  const out: ToolCall[] = [];
  let idx = 0;
  for (const m of content.matchAll(TEXT_TOOL_CALL_RE)) {
    const jsonText = m[1];
    let parsed: { name?: unknown; arguments?: unknown };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      logger.warn(`[MiniMax] 文本 tool_call JSON 解析失败，跳过: ${jsonText.slice(0, 80)}...`);
      continue;
    }
    if (typeof parsed.name !== 'string' || parsed.name === '') {
      logger.warn(`[MiniMax] 文本 tool_call 缺少 name 字段，跳过: ${jsonText.slice(0, 80)}...`);
      continue;
    }
    let argsString: string;
    if (typeof parsed.arguments === 'string') {
      argsString = parsed.arguments;
    } else if (parsed.arguments && typeof parsed.arguments === 'object') {
      argsString = JSON.stringify(parsed.arguments);
    } else {
      argsString = '{}';
    }
    out.push({
      id: `text_call_${idx}`,
      name: parsed.name,
      arguments: argsString,
    });
    idx++;
  }
  return out;
}

/**
 * 从 content 中剥除 `<tool_call>...</tool_call>` 文本块（保留其余叙述）。
 * 关键意义：避免下一轮模型回看自己的上一条消息时，把已经"伪调用"过的 tool_call
 * 当作真实发起过，从而放弃在下一轮重新 emit 结构化 tool_call —— 这是 Two-Stage
 * ReAct（Phase 1 思考 + Phase 2 行动）下模型最常见的卡死原因。
 */
export function stripTextToolCallBlocks(content: string): string {
  if (!content) return content;
  // 用 g 标志全局替换；保留块前后的叙述，只删除块本身
  // 再把 3+ 连续换行折叠成 2，避免剥离块后留下尴尬的多个空行
  return content
    .replace(TEXT_TOOL_CALL_RE, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * MiniMax Provider - 实现 LLMProvider 接口
 * MiniMax API 采用 OpenAI 兼容格式
 */
export class MiniMaxProvider implements LLMProvider {
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor(model: string = 'MiniMax-M3') {
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
      /** OpenAI 兼容字段：Token 用量，供 CostTracker 等可观测层消费。 */
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
      };
    };

    logger.debug(`[MiniMax] 响应体: ${JSON.stringify(data, null, 2)}`);

    // 5. 反向解析：将 MiniMax 响应转换为内部 Message
    return this.parseResponse(data, data.usage);
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
    },
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
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

    // 透传 Token 用量，供 CostTracker 计算成本；缺失时静默留空。
    if (usage) {
      resultMsg.usage = {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
      };
    }

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      resultMsg.tool_calls = choice.message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));
    } else {
      // 兜底：模型有时把 tool_call 塞进 content 文本（Qwen/Hermes 风格）。
      // 结构化字段为空时扫描文本，把识别出的块补回 tool_calls，避免引擎误判"任务完成"。
      const recovered = parseTextToolCalls(resultMsg.content);
      if (recovered.length > 0) {
        logger.warn(
          `[MiniMax] 检测到 ${recovered.length} 个文本格式 tool_call，已自动转结构化（name=${recovered.map((t) => t.name).join(',')}）`
        );
        resultMsg.tool_calls = recovered;
      }
    }

    // 无论走哪条路径，都把 content 里的文本 tool_call 块剥掉。
    // 关键：避免下一轮模型回看上下文时，把自己上一轮的"伪调用"误判为已发起。
    const stripped = stripTextToolCallBlocks(resultMsg.content);
    if (stripped !== resultMsg.content) {
      logger.warn('[MiniMax] 已从 content 剥离文本 tool_call 块，避免污染后续 turn 上下文');
      resultMsg.content = stripped;
    }

    return resultMsg;
  }
}
