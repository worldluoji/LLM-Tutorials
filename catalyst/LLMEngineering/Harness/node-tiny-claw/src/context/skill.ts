import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../utils/logger.ts';

/**
 * Skill 表示从 SKILL.md 中解析出的标准化技能结构
 */
export interface Skill {
  /** 技能名称，对应 Frontmatter 中的 name 字段 */
  name: string;
  /** 触发条件描述，对应 Frontmatter 中的 description 字段 */
  description: string;
  /** Markdown 正文指令（去除 Frontmatter 后的部分） */
  body: string;
}

const SKILL_FILENAME = 'SKILL.md';
const SKILL_BASE_DIR = path.join('.claw', 'skills');
const SKILL_MIN_LENGTH = 100;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const HEADER =
  '\n### 可用专业技能 (Agent Skills)\n' +
  '以下是你拥有的标准化外挂技能，请在符合 description 描述的场景下严格遵循其正文指令：\n\n';

/**
 * SkillLoader 负责从工作区下的 .claw/skills 目录扫描并解析所有 SKILL.md，
 * 将其序列化为可注入到 System Prompt 的格式化字符串
 */
export class SkillLoader {
  private readonly workDir: string;

  constructor(workDir: string) {
    this.workDir = workDir;
  }

  /**
   * loadAll 扫描 .claw/skills 目录，解析所有 SKILL.md，并格式化为字符串
   * @returns 拼接好的技能字符串；若目录不存在或没有可用技能则返回空串
   */
  async loadAll(): Promise<string> {
    const skillBaseDir = path.join(this.workDir, SKILL_BASE_DIR);

    try {
      await fs.access(skillBaseDir);
    } catch {
      return '';
    }

    const skills: Skill[] = [];
    try {
      const files = await collectSkillFiles(skillBaseDir);
      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          skills.push(parseSkillMD(content));
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          logger.warn(`[SkillLoader] 跳过无效技能文件 ${filePath}: ${errMsg}`);
        }
      }
    } catch {
      return '';
    }

    const formatted = formatSkills(skills);
    if (formatted.length < SKILL_MIN_LENGTH) {
      return '';
    }
    return formatted;
  }
}

/**
 * collectSkillFiles 递归扫描目录，收集所有名为 SKILL.md 的文件绝对路径
 * 跳过符号链接；目录不可读时返回空数组
 */
async function collectSkillFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectSkillFiles(fullPath)));
    } else if (entry.isFile() && entry.name === SKILL_FILENAME) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * parseSkillMD 极简解析带有 YAML Frontmatter 的 Markdown 内容
 * - 文件以 `---` 开头并以独占一行的 `---` 闭合时，提取 Frontmatter 与 Body
 * - 否则将整段内容作为 Body，name/description 走默认值
 */
function parseSkillMD(content: string): Skill {
  const skill: Skill = {
    name: 'Unknown Skill',
    description: 'No description provided.',
    body: content,
  };

  const match = FRONTMATTER_RE.exec(content);
  if (!match) {
    return skill;
  }

  const frontmatter = match[1];
  skill.body = content.slice(match[0].length).trim();

  for (const rawLine of frontmatter.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('name:')) {
      skill.name = line.slice('name:'.length).trim();
    } else if (line.startsWith('description:')) {
      skill.description = line.slice('description:'.length).trim();
    }
  }

  return skill;
}

/**
 * formatSkills 将技能数组序列化为可注入 Prompt 的字符串
 */
function formatSkills(skills: Skill[]): string {
  const parts: string[] = [HEADER];
  for (const skill of skills) {
    parts.push(`#### 技能名称: ${skill.name}\n`);
    parts.push(`**触发条件**: ${skill.description}\n\n`);
    parts.push('**执行指南**:\n');
    parts.push(skill.body);
    parts.push('\n\n---\n');
  }
  return parts.join('');
}
