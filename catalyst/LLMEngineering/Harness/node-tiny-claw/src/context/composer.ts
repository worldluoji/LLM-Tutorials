import fs from 'node:fs/promises';
import path from 'node:path';
import { Message, Role } from '../schema/message.ts';
import { SkillLoader } from './skill.ts';

const AGENTS_FILENAME = 'AGENTS.md';

const CORE_IDENTITY =
  '# 核心身份\n' +
  '你名叫 node-tiny-claw，一个由驾驭工程驱动的骨灰级研发助手。\n' +
  '你具备极简主义哲学，拒绝废话。你能通过系统提供的内置工具，创建、读取、修改和执行工作区中的代码。\n' +
  '\n' +
  '# 核心纪律 (CRITICAL)\n' +
  '1. 如需检查文件是否存在，请使用 bash 的 ls 或 test -f，而不是对目录使用 read_file。\n' +
  '2. 创建新文件时，务必使用 write_file，并同时提供 path 和 content 参数。\n' +
  '3. 编辑文件前务必先读取现有文件，以理解上下文。\n' +
  '4. 无论何时你需要写代码或创建文件，都要直接使用 write_file 工具。\n' +
  '5. 遇到工具执行报错时，仔细阅读 stderr，尝试自己修正命令并重试。\n' +
  '6. 始终用中文回复，以便传达你的进展和想法。\n' +
  '7. 你在前一条消息（包括你自己的思考文本）中描述的工具调用意图不会自动执行；\n' +
  '   如果你希望真正调用工具，必须在当前消息中通过平台原生结构化字段重新发起。\n' +
  '   绝不要在回复正文中伪造工具结果——想看到结果就必须真的调用工具。\n';

const AGENTS_HEADER =
  '\n# 项目专属指南 (来自 AGENTS.md)\n' +
  '以下是当前工作区特有的架构规范与注意事项，你的行为必须绝对符合以下要求：\n' +
  '```markdown\n';

const AGENTS_FOOTER = '\n```\n';

/**
 * PromptComposer 负责按"极简内核 → AGENTS.md → Skills"的顺序动态生成 System Prompt
 */
export class PromptComposer {
  private readonly workDir: string;
  private readonly skillLoader: SkillLoader;

  constructor(workDir: string) {
    this.workDir = workDir;
    this.skillLoader = new SkillLoader(workDir);
  }

  /**
   * build 组装并返回一条 RoleSystem 消息
   * - 极简内核总是输出
   * - AGENTS.md 缺失或不可读时静默跳过
   * - 没有可用 Skills 时静默跳过
   */
  async build(): Promise<Message> {
    const parts: string[] = [CORE_IDENTITY];

    const agentsPath = path.join(this.workDir, AGENTS_FILENAME);
    try {
      const content = await fs.readFile(agentsPath, 'utf-8');
      parts.push(AGENTS_HEADER);
      parts.push(content);
      parts.push(AGENTS_FOOTER);
    } catch {
      // AGENTS.md 缺失或不可读：静默跳过
    }

    const skillsContent = await this.skillLoader.loadAll();
    if (skillsContent !== '') {
      parts.push(skillsContent);
    }

    return {
      role: Role.System,
      content: parts.join(''),
    };
  }
}
