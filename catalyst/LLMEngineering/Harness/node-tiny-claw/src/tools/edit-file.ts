import { BaseTool } from './registry.js';
import { ToolDefinition } from '../schema/message.js';
import { logger } from '../utils/logger.js';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * EditFileTool 对现有文件进行局部的字符串替换。
 * 内置 L1→L4 多级模糊匹配，对大模型常见的换行 / 缩进 / 空白失配有强容错。
 */
export class EditFileTool extends BaseTool {
  private workDir: string;

  constructor(workDir: string) {
    super();
    this.workDir = workDir;
  }

  name(): string {
    return 'edit_file';
  }

  definition(): ToolDefinition {
    return {
      name: this.name(),
      description:
        '对现有文件进行局部的字符串替换。这比重写整个文件更安全、更快速。请提供足够的 old_text 上下文以确保匹配的唯一性。',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: '要修改的文件路径',
          },
          old_text: {
            type: 'string',
            description:
              '文件中原有的文本。必须包含足够的上下文（建议上下各多包含几行），以确保在文件中的唯一性。',
          },
          new_text: {
            type: 'string',
            description: '要替换成的新文本',
          },
        },
        required: ['path', 'old_text', 'new_text'],
      },
    };
  }

  async execute(args: Record<string, unknown> | string): Promise<string> {
    // 1. 延迟解析
    let input: { path?: string; old_text?: string; new_text?: string };
    if (typeof args === 'string') {
      try {
        input = JSON.parse(args) as { path?: string; old_text?: string; new_text?: string };
      } catch {
        return '参数解析失败: 无效的 JSON 格式';
      }
    } else {
      input = args as { path?: string; old_text?: string; new_text?: string };
    }

    if (!input.path || !input.old_text || !input.new_text) {
      return '参数解析失败: 缺少必需参数 "path"、"old_text" 或 "new_text"';
    }

    // 2. 拼接绝对路径
    const fullPath = path.join(this.workDir, input.path);

    // 3. 安全检查：防止路径穿越
    if (!fullPath.startsWith(this.workDir)) {
      logger.error(`[EditFileTool] 路径穿越检测: ${fullPath} 不在 ${this.workDir} 内`);
      return `Error: 路径 '${input.path}' 超出工作区范围。`;
    }

    // 4. 读取原文件
    let originalContent: string;
    try {
      originalContent = await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes('ENOENT') || errMsg.includes('no such file')) {
        return `Error: 文件 '${input.path}' 不存在。`;
      }
      return `Error: 读取文件失败，请确认路径是否正确: ${errMsg}`;
    }

    // 5. 调用多级模糊替换
    const replaced = fuzzyReplace(originalContent, input.old_text, input.new_text);
    if (replaced.kind === 'error') {
      return `Error: ${replaced.message}`;
    }

    // 6. 写回磁盘
    try {
      await fs.writeFile(fullPath, replaced.content, 'utf-8');
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return `Error: 写回文件失败: ${errMsg}`;
    }

    logger.info(`[EditFileTool] 成功修改文件: ${input.path}`);
    return `成功修改文件: ${input.path}`;
  }
}

// ==========================================
// 多级模糊替换算法（对应 Go 的 fuzzyReplace + lineByLineReplace）
// ==========================================

type FuzzyResult = { kind: 'ok'; content: string } | { kind: 'error'; message: string };

/**
 * fuzzyReplace 实现 L1→L4 四级容错降级：
 *   L1 精确匹配       —— old_text 在原文中出现且唯一
 *   L2 换行归一化     —— 统一把 \r\n 视为 \n 后再匹配
 *   L3 TrimSpace      —— 忽略 old_text 整体首尾空白后匹配
 *   L4 逐行去缩进     —— 把文本按行拆分、每行 trim 后做滑动窗口匹配
 */
function fuzzyReplace(originalContent: string, oldText: string, newText: string): FuzzyResult {
  // L1: 精确匹配
  const l1Count = originalContent.split(oldText).length - 1;
  if (l1Count === 1) {
    return { kind: 'ok', content: originalContent.replace(oldText, newText) };
  }
  if (l1Count > 1) {
    return {
      kind: 'error',
      message: `old_text 匹配到了 ${l1Count} 处，请提供更多的上下文代码以确保唯一性`,
    };
  }

  // L2: 换行符归一化
  const normalizedContent = originalContent.replace(/\r\n/g, '\n');
  const normalizedOld = oldText.replace(/\r\n/g, '\n');

  const l2Count = normalizedContent.split(normalizedOld).length - 1;
  if (l2Count === 1) {
    return { kind: 'ok', content: normalizedContent.replace(normalizedOld, newText) };
  }

  // L3: TrimSpace 匹配
  const trimmedOld = normalizedOld.trim();
  if (trimmedOld !== '') {
    const l3Count = normalizedContent.split(trimmedOld).length - 1;
    if (l3Count === 1) {
      // 接受 L3/L4 触发时 newText 与上下文缩进不一致的格式损失 —— 总比让 Agent 死循环自愈好
      return { kind: 'ok', content: normalizedContent.replace(trimmedOld, newText) };
    }
  }

  // L4: 逐行去缩进匹配
  return lineByLineReplace(normalizedContent, normalizedOld, newText);
}

/**
 * lineByLineReplace 把 oldText 按行拆分并 trim，再在 contentLines 上做滑动窗口匹配。
 * 命中后用 newText（作为整体）替换掉对应行范围。
 */
function lineByLineReplace(content: string, oldText: string, newText: string): FuzzyResult {
  const contentLines = content.split('\n');
  const oldLines = oldText.trim().split('\n');

  if (oldLines.length === 0 || contentLines.length < oldLines.length) {
    return { kind: 'error', message: '找不到该代码片段' };
  }

  const trimmedOldLines = oldLines.map((line) => line.trim());

  let matchCount = 0;
  let matchStartIndex = -1;
  let matchEndIndex = -1;

  for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
    let isMatch = true;
    for (let j = 0; j < oldLines.length; j++) {
      if (contentLines[i + j].trim() !== trimmedOldLines[j]) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) {
      matchCount++;
      matchStartIndex = i;
      matchEndIndex = i + oldLines.length;
    }
  }

  if (matchCount === 0) {
    return {
      kind: 'error',
      message: '在文件中未找到 old_text，请大模型先调用 read_file 仔细确认文件内容和缩进',
    };
  }
  if (matchCount > 1) {
    return {
      kind: 'error',
      message: `模糊匹配到了 ${matchCount} 处相似代码，请提供更多上下行代码以精确定位`,
    };
  }

  // 把匹配行范围整体替换为 newText（newText 自身可含换行，作为单个数组元素即可被 join 还原）
  const newContentLines: string[] = [
    ...contentLines.slice(0, matchStartIndex),
    newText,
    ...contentLines.slice(matchEndIndex),
  ];

  return { kind: 'ok', content: newContentLines.join('\n') };
}
