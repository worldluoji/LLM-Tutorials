import { BaseTool } from './registry.js';
import { ToolDefinition } from '../schema/message.js';
import { logger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 超时时间 30 秒
const TIMEOUT_MS = 30000;

/**
 * BashTool 执行 bash 命令的工具
 */
export class BashTool extends BaseTool {
  private workDir: string;

  constructor(workDir: string) {
    super();
    this.workDir = workDir;
  }

  name(): string {
    return 'bash';
  }

  definition(): ToolDefinition {
    return {
      name: this.name(),
      description:
        '在当前工作区执行任意的 bash 命令。支持链式命令(如 &&)。返回标准输出(stdout)和标准错误(stderr)。',
      input_schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: '要执行的 bash 命令，例如: ls -la 或 go test ./...',
          },
        },
        required: ['command'],
      },
    };
  }

  async execute(args: Record<string, unknown> | string): Promise<string> {
    // 1. 延迟解析
    let input: { command?: string };
    if (typeof args === 'string') {
      try {
        input = JSON.parse(args) as { command?: string };
      } catch {
        return '参数解析失败: 无效的 JSON 格式';
      }
    } else {
      input = args as { command?: string };
    }

    if (!input.command) {
      return '参数解析失败: 缺少必需参数 "command"';
    }

    logger.info(`[BashTool] 执行命令: ${input.command}`);

    // 2. 执行 bash 命令
    try {
      // 使用 timeout 参数执行命令
      const { stdout, stderr } = await execAsync(`bash -c "${input.command.replace(/"/g, '\\"')}"`, {
        cwd: this.workDir,
        timeout: TIMEOUT_MS,
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      let output = stdout + stderr;

      // 如果没有终端输出
      if (!output) {
        return '命令执行成功，无终端输出。';
      }

      // 长度截断保护
      const maxLen = 8000;
      if (output.length > maxLen) {
        return `${output.slice(0, maxLen)}\n\n...[终端输出过长，已截断至前 ${maxLen} 字节]...`;
      }

      return output;
    } catch (error) {
      // 超时处理
      if (error instanceof Error && error.message.includes('timeout')) {
        return `[警告: 命令执行超时(${TIMEOUT_MS / 1000}s)，已被系统强制终止。如果是启动常驻服务，请尝试将其转入后台。]`;
      }

      // 错误原样回传，让模型有机会自愈
      const errMsg = error instanceof Error ? error.message : String(error);
      return `执行报错: ${errMsg}`;
    }
  }
}