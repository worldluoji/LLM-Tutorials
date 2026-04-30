import { BaseTool } from './registry.js';
import { ToolDefinition } from '../schema/message.js';
import { logger } from '../utils/logger.js';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * WriteFileTool 写入文件内容的工具
 */
export class WriteFileTool extends BaseTool {
  private workDir: string;

  constructor(workDir: string) {
    super();
    this.workDir = workDir;
  }

  name(): string {
    return 'write_file';
  }

  definition(): ToolDefinition {
    return {
      name: this.name(),
      description: '创建或覆盖写入一个文件。如果目录不存在会自动创建。请提供相对于工作区的相对路径。',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要写入的文件路径，如 src/main.ts',
          },
          content: {
            type: 'string',
            description: '要写入的完整文件内容',
          },
        },
        required: ['path', 'content'],
      },
    };
  }

  async execute(args: Record<string, unknown> | string): Promise<string> {
    // 1. 延迟解析
    let input: { path?: string; content?: string };
    if (typeof args === 'string') {
      try {
        input = JSON.parse(args) as { path?: string; content?: string };
      } catch {
        return '参数解析失败: 无效的 JSON 格式';
      }
    } else {
      input = args as { path?: string; content?: string };
    }

    if (!input.path || !input.content) {
      return '参数解析失败: 缺少必需参数 "path" 或 "content"';
    }

    // 2. 拼接绝对路径
    const fullPath = path.join(this.workDir, input.path);

    // 3. 安全检查：确保路径在 workDir 内（防止路径穿越攻击）
    if (!fullPath.startsWith(this.workDir)) {
      logger.error(`[WriteFileTool] 路径穿越检测: ${fullPath} 不在 ${this.workDir} 内`);
      return `Error: 路径 '${input.path}' 超出工作区范围。`;
    }

    // 4. 自动创建缺失的父级目录
    try {
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return `Error: 创建父目录失败: ${errMsg}`;
    }

    // 5. 写入文件内容
    try {
      await fs.writeFile(fullPath, input.content, 'utf-8');
      return `成功将内容写入到文件: ${input.path}`;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return `Error: 写入文件失败: ${errMsg}`;
    }
  }
}