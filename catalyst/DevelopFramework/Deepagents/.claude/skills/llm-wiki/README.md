# llm-wiki 技能

本技能实现 LLM-Wiki 思想，落地为本地化的个人股票与投研知识库。

## 目录结构

```
.claude/skills/llm-wiki/
├── SKILL.md              # 技能主入口（Claude 读取此文件以激活技能）
├── README.md             # 本文件（人类阅读）
├── references/
│   └── schema.md         # Wiki 结构定义、frontmatter、章节顺序
├── templates/
│   ├── stock.md          # 个股页模板
│   ├── industry.md       # 行业页模板
│   ├── macro.md          # 宏观/概念页模板
│   ├── source.md         # 资料摘要页模板
│   └── strategy.md       # 策略/复盘页模板
└── scripts/
    ├── import_pdf.sh     # PDF → Markdown 一键转换
    └── health_check.sh   # Wiki 健康检查
```

## 知识库根目录

```
data/                      # 知识库根
├── raw/                   # 只读：PDF + markitdown 转出的 Markdown
├── wiki/                  # 读写：结构化 Wiki 页面
│   ├── index.md
│   └── log.md
├── schema.md              # Wiki 组织规则
└── .llm-wiki/             # LLM 工作区
    └── health-report.md
```

## 快速使用

1. **导入资料**
   ```bash
   # 把 PDF 放到 data/raw/ 下，然后：
   bash .claude/skills/llm-wiki/scripts/import_pdf.sh 002261_2025_annual_report.pdf
   # 或者批量：
   bash .claude/skills/llm-wiki/scripts/import_pdf.sh --all
   ```

2. **让 LLM 处理 Markdown**（在 Claude Code 对话中）
   > 帮我把 data/raw/002261_2025_annual_report.md 导入到 wiki，并创建相应的个股页、行业页、宏观页。

3. **健康检查**
   ```bash
   bash .claude/skills/llm-wiki/scripts/health_check.sh
   ```

## 设计参考

基于 Andrej Karpathy 提出的 LLM-Wiki 思想。原始文档参见 `2. LLM-Wiki.md`、`3. Wiki-Action.md`。