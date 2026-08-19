# Wiki Schema — 投研知识库结构定义

> 本文件由 llm-wiki skill 初始化。完整定义见项目 `.claude/skills/llm-wiki/references/schema.md`。
> 当前版本: v1.0   最近更新: 2026-08-19

## 三层架构

| 层级 | 路径 | 性质 | 说明 |
|------|------|------|------|
| Raw Sources | `/data/raw/` | 只读，不可变 | 原始资料（PDF / markitdown 转出的 .md） |
| Wiki | `/data/wiki/` | LLM 读写 | 结构化 Markdown 知识库 |
| Schema | `/data/schema.md` | 本文件 | Wiki 结构与工作流配置 |
| LLM Workspace | `/data/.llm-wiki/` | LLM 读写 | 健康报告、待处理队列、临时索引 |

## 页面类型与命名

| 类型 | 命名格式 | 示例 |
|------|---------|------|
| 个股档案 | `{6位代码}-{公司简称}.md` | `300750-宁德时代.md` |
| 行业综述 | `industry-{行业名}.md` | `industry-动力电池.md` |
| 宏观/概念 | `macro-{概念名}.md` | `macro-美联储加息.md` |
| 资料摘要 | `source-{代码或关键词}-{年份或日期}.md` | `source-300750-2025年报.md` |
| 策略/复盘 | `strategy-{策略名}.md` | `strategy-网格交易复盘.md` |

所有页面统一放在 `/data/wiki/` 根目录。

## 关键文件

- `/data/wiki/index.md` — 内容总览目录
- `/data/wiki/log.md` — 投研操作日志（时间倒序）
- `/data/.llm-wiki/health-report.md` — 健康检查报告

## 详细规范

完整 frontmatter 字段表、章节顺序、矛盾处理规则、工作流请参见：

**`.claude/skills/llm-wiki/references/schema.md`**

## 更新记录

- 2026-08-19 — v1.0 初始化（由 llm-wiki skill 创建）