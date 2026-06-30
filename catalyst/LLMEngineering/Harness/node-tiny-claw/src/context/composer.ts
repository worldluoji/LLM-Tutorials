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
 * Plan Mode 强制规范段：状态外部化（Externalized State）。
 * 开启后模型必须把架构思路写到 PLAN.md，把执行步骤写到 TODO.md，
 * 每完成一步立即把对应行打勾 [x]，避免依赖短期记忆丢失进度。
 *
 * 位置语义：必须出现在 CORE_IDENTITY 之后、AGENTS.md 之前——
 * plan mode 是"工作模式"指令，必须早于项目专属规范生效。
 */
const PLAN_MODE_SECTION = `
# 长程任务与状态外部化强制规范 (Plan Mode: ON)

!!! 警告：本模式下，你绝对不能依赖自己的短期记忆。你必须将所有的架构思路和执行进度持久化到物理文件中。 !!!

当你收到一条新指令被唤醒时，你必须、且只能按照以下【绝对顺序】执行你的动作：

**[STEP 1: 强制环境嗅探 (Bootstrapping)]**
- 收到指令后，你必须第一时间使用 bash (如: \`ls -la\`) 检查当前工作区根目录下是否已经存在 \`PLAN.md\` 和 \`TODO.md\`。
- **分支 A (全新任务)**：如果这两个文件不存在，说明这是一个全新的任务。你必须使用 write_file 依次创建它们：
  1. 先创建 \`PLAN.md\`，写下你的理解、架构设计、技术选型。
  2. 再创建 \`TODO.md\`，拆解出具体的可执行步骤（使用标准的 Markdown Checkbox 格式，如 \`- [ ] 步骤1\`）。
- **分支 B (断点续传/任务唤醒)**：如果这两个文件已经存在，**绝对不要覆盖它们！** 这意味着系统刚刚重启，或者人类接管了进度。你必须立即使用 read_file 仔细阅读 \`PLAN.md\` 了解全局目标，并阅读 \`TODO.md\` 寻找第一个未被打勾的 \`- [ ]\` 任务，从那里直接继续干活。

**[STEP 2: 严格的单步执行与实时打勾]**
- 开始执行 \`TODO.md\` 中未完成的任务。
- **强制约束**：每当你通过 write_file 或 bash 真正完成了一个子任务后，你**必须立即停下来**，优先使用 edit_file 工具（或 bash 的 sed 命令），将 \`TODO.md\` 中对应的行修改为 \`- [x]\`。
- 绝对不允许"一口气写完所有代码最后再打勾"。做完一步，必须打勾一步！

**[STEP 3: 迷失时的自救]**
- 如果你在执行中遇到了报错，或者不知道下一步该干嘛了，立即使用 read_file 重新读取 \`TODO.md\` 确认自己的位置。
`;

/**
 * PromptComposer 负责按"极简内核 → [Plan Mode?] → AGENTS.md → Skills"的顺序动态生成 System Prompt
 */
export class PromptComposer {
  private readonly workDir: string;
  private readonly planMode: boolean;
  private readonly skillLoader: SkillLoader;

  constructor(workDir: string, planMode: boolean = false) {
    this.workDir = workDir;
    this.planMode = planMode;
    this.skillLoader = new SkillLoader(workDir);
  }

  /**
   * build 组装并返回一条 RoleSystem 消息
   * - 极简内核总是输出
   * - Plan Mode 开启时，紧跟内核之后注入强制规范段
   * - AGENTS.md 缺失或不可读时静默跳过
   * - 没有可用 Skills 时静默跳过
   */
  async build(): Promise<Message> {
    const parts: string[] = [CORE_IDENTITY];

    if (this.planMode) {
      parts.push(PLAN_MODE_SECTION);
    }

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
