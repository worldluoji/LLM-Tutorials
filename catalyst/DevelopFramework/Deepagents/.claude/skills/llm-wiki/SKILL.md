---
name: llm-wiki
description: 基于 LLM-Wiki 思想构建和维护个人股票与投研知识库。当用户要求创建股票知识库、导入券商研报/财报 PDF、查询投研逻辑、维护知识库健康状态（如检查逻辑矛盾、链接断裂、信息过时）时触发。在 raw/wiki/schema 三层目录中运作：raw 层存放原始资料（PDF 经 markitdown 转 Markdown），wiki 层由 AI 维护的结构化 Markdown 页面组成（个股/行业/宏观/概念/资料摘要/策略复盘），schema 层定义组织规则。
---

# LLM-Wiki 投研知识库技能

本技能把 LLM-Wiki 思想落地为一个本地化的个人股票与投研知识库。所有内容以纯 Markdown + 文件系统组织，可用 VS Code / Obsidian / Git 直接浏览与管理，不依赖向量数据库。

## 触发场景

满足以下任一意图时使用本技能：

| 场景 | 触发短语示例 |
|------|------------|
| **创建知识库** | "帮我建一个投研 wiki"、"初始化我的股票知识库" |
| **导入资料** | "导入这份年报"、"把这份研报加到 wiki"、"把 data/raw 下的 PDF 都处理一下" |
| **查询逻辑** | "宁德时代最近的核心矛盾是什么"、"燕京啤酒 vs 青岛啤酒的差异"、"美联储加息对动力电池的影响" |
| **健康检查** | "检查一下 wiki 有没有矛盾"、"看看有没有过时的数据"、"补全断掉的链接" |

## 三层架构（必须遵守）

```
<KB_ROOT>/                       # 知识库根，本项目固定为 /Users/luoji1/code/LLM-Tutorials/catalyst/DevelopFramework/Deepagents/data
├── raw/                         # 只读层：PDF + markitdown 转出的 Markdown
├── wiki/                        # LLM 读写层：结构化知识页面
│   ├── index.md                 # 总目录（LLM 每次导入时更新）
│   └── log.md                   # 操作日志（按时间倒序追加）
├── schema.md                    # Wiki 组织规则（人在此与 LLM 共创）
└── .llm-wiki/                   # LLM 工作区（健康检查报告、待处理队列等）
```

完整规范见 `references/schema.md`。核心约束：

1. **raw 层只读**：永远不要修改 raw 中的文件，它是结论的"证据"。
2. **wiki 层结构一致**：所有页面必须遵循 frontmatter + 固定章节顺序。
3. **schema 是真理之源**：遇到结构性问题（页面放错目录、命名不规范）优先改 schema.md，再批量迁移。

## 页面类型与命名

| 类型 | 文件命名 | 示例 |
|------|---------|------|
| 个股页 | `{6位代码}-{公司简称}.md` | `300750-宁德时代.md` |
| 行业页 | `industry-{行业名}.md` | `industry-动力电池.md` |
| 宏观/概念页 | `macro-{概念}.md` | `macro-美联储加息.md` |
| 资料摘要 | `source-{代码或关键词}-{年份或日期}.md` | `source-300750-2025年报.md` |
| 策略/复盘 | `strategy-{策略名}.md` | `strategy-网格交易复盘.md` |

所有页面统一存放在 `wiki/` 根目录（不再分子目录），便于 Obsidian 图谱视图。Wikilink 格式：`[[300750-宁德时代]]`。

## 工作流程

### 场景 1：创建/初始化知识库

1. 检查 `KB_ROOT` 是否存在，不存在则 `mkdir -p data/{raw,wiki,.llm-wiki}`。
2. 检查 `data/schema.md` 是否存在，不存在则从本技能 `references/schema.md` 复制一份。
3. 写入 `data/wiki/index.md`（空骨架）和 `data/wiki/log.md`（含创建记录）。
4. 在 `data/.llm-wiki/` 创建 `health-report.md`（空）。
5. 回报初始化结果 + 当前已存在的 raw 资料数量（`ls data/raw | wc -l`）。

### 场景 2：导入研报/财报 PDF

完整流程（**任何 PDF 必须经过此流程**）：

```
步骤 1: 转换
   如果 raw/<file>.md 不存在：
     /Users/luoji1/code/LLM-Tutorials/catalyst/DevelopFramework/Deepagents/demo/.venv/bin/python -m \
       markitdown data/raw/<file>.pdf -o data/raw/<file>.md
   也可调用 scripts/import_pdf.sh <file.pdf> 一键完成。

步骤 2: 阅读 raw 层
   完整读取 raw/<file>.md，识别：股票代码、公司全称、报告期间、报告类型
   （年报/季报/券商研报/新闻）、核心数据、关键观点、风险提示。

步骤 3: 创建/更新资料摘要页
   路径：wiki/source-{代码或关键词}-{年份或日期}.md
   frontmatter + 固定章节：报告基本信息 / 核心数据 / 主要观点 / 关键风险 / 提取的实体

步骤 4: 关联实体页
   对摘要中出现的每只股票 → 更新或创建 wiki/{代码}-{简称}.md
   对所属行业 → 更新或创建 wiki/industry-{行业}.md
   对涉及概念（如"美联储加息"、"钠离子电池"）→ 更新或创建 wiki/macro-{概念}.md

步骤 5: 更新 index.md
   在对应分类下追加新条目：[[source-xxx]] — 一句话核心观点

步骤 6: 追加 log.md
   格式：## [YYYY-MM-DD] 导入 | 文件名 | 涉及实体

步骤 7: 健康自检
   在 wiki 页之间建立 [[wikilink]]；如果有页面之间结论冲突，在双方都用
   ⚠️ 矛盾标注 块显式记录，禁止静默覆盖。
```

实体页个股模板见 `templates/stock.md`。每只股票的页面要随新资料增量更新（追加章节、修订数字），而不是覆盖。

### 场景 3：查询投研逻辑

1. 先读 `data/wiki/index.md`，按分类定位候选页面。
2. 沿着 wikilink 链读相关页面（个股 → 行业 → 宏观 → 资料摘要 → 反向引用）。
3. **必须回溯证据**：涉及具体数字或观点时，链接到 source 页面并指明来自 raw 的哪份资料。
4. 回答时区分：① Wiki 已沉淀的结论 ② 跨页面综合推断 ③ 待补充的盲区。
5. 若用户问题超出 Wiki 覆盖范围，明确说明"Wiki 暂无该资料"，并提示可补充的资料类型。

### 场景 4：健康检查

运行 `scripts/health_check.sh`（或手动执行下列步骤）：

```
检查项：
1. 链接完整性
   - 所有 wikilink [[xxx]] 是否都指向已存在的 .md 文件
   - 列出所有 dangling links 到 data/.llm-wiki/dangling-links.md

2. 矛盾检测
   - 在个股/行业页扫描 ⚠️ 矛盾标注 块
   - 跨页面同一指标数值不一致（如营收增速 22.79% vs 22.81%）→ 列出冲突页

3. 时效性
   - 资料摘要页的 frontmatter.report_date，距今超过 1 年的标"⚠️ 过期"
   - 个股最新业绩日期超过 6 个月且无新研报 → "⚠️ 数据陈旧"

4. 覆盖度
   - 个股页是否包含核心章节（财务摘要/业务结构/投资逻辑/风险点/来源链接）
   - 缺失章节 → 列出待补全清单

报告输出：
   汇总写入 data/.llm-wiki/health-report.md，分区列出上述问题
   index.md 顶部加一行：最近体检：YYYY-MM-DD，X 个问题（链接到报告）
```

## 关键纪律

- **不覆盖，只增量**：每次导入都向现有页面追加新章节，不删除旧数据；过时信息加 `⚠️ 已过时` 标记。
- **矛盾显式化**：不同来源结论冲突时，新建"⚠️ 矛盾"区块列出各方说法与来源，禁止合并叙述。
- **来源可追溯**：个股/行业页任何结论段落末尾都要有"→ 参见 [[source-xxx]]"。
- **schema 优先**：发现页面结构不符合 schema 时，先更新 schema.md，再按新 schema 调整历史页面。
- **markitdown 不可省**：PDF 必须先转 Markdown，绝不直接读取 PDF 原文。

## 关联文件

- `references/schema.md` — 完整 schema 定义（页面 frontmatter、章节顺序、frontmatter 字段表）。
- `templates/stock.md` — 个股页模板。
- `templates/industry.md` — 行业页模板。
- `templates/macro.md` — 宏观/概念页模板。
- `templates/source.md` — 资料摘要页模板。
- `templates/strategy.md` — 策略/复盘页模板。
- `scripts/import_pdf.sh` — PDF → Markdown 一键转换脚本。
- `scripts/health_check.sh` — 健康检查脚本（链接 + 矛盾 + 时效）。