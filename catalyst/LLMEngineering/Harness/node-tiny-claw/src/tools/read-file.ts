import { BaseTool } from './registry.js';
import { ToolDefinition } from '../schema/message.js';
import { logger } from '../utils/logger.js';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * ReadFileTool 读取本地文件内容的工具
 */
export class ReadFileTool extends BaseTool {
  private workDir: string;

  constructor(workDir: string) {
    super();
    this.workDir = workDir;
  }

  name(): string {
    return 'read_file';
  }

  definition(): ToolDefinition {
    return {
      name: this.name(),
      description: '读取指定路径的文件内容。请提供相对工作区的路径。',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要读取的文件路径，如 src/main.ts',
          },
        },
        required: ['path'],
      },
    };
  }

  async execute(args: Record<string, unknown> | string): Promise<string> {
    // 1. 延迟解析：将大模型传过来的 JSON 参数解析为强类型结构体
    let input: { path?: string };
    if (typeof args === 'string') {
      try {
        input = JSON.parse(args) as { path?: string };
      } catch {
        return '参数解析失败: 无效的 JSON 格式';
      }
    } else {
      input = args as { path?: string };
    }

    if (!input.path) {
      return '参数解析失败: 缺少必需参数 "path"';
    }

    // 2. 拼接绝对路径
    const fullPath = path.join(this.workDir, input.path);

    // 3. 安全检查：确保路径在 workDir 内（防止路径穿越攻击）
    if (!fullPath.startsWith(this.workDir)) {
      logger.error(`[ReadFileTool] 路径穿越检测: ${fullPath} 不在 ${this.workDir} 内`);
      return `Error: 路径 '${input.path}' 超出工作区范围。`;
    }

    // 4. 执行物理 IO 操作
    try {
      let content = await fs.readFile(fullPath, 'utf-8');

      // 5. 长度截断保护：防止大模型读取超大文件导致 OOM
      const maxLen = 8000;
      if (content.length > maxLen) {
        const truncated = content.slice(0, maxLen);
        return `${truncated}\n\n...[由于内容过长，已被系统截断至前 ${maxLen} 字节]...`;
      }

      return content;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('ENOENT') || errMsg.includes('no such file')) {
        return `Error: 文件 '${input.path}' 不存在。`;
      }
      return `Error: 读取文件失败: ${errMsg}`;
    }
  }
}
