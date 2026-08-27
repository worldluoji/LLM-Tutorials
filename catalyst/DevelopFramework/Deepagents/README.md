# Deepagents 投研知识库实战

本项目演示如何基于 **Deepagents** Agent Harness + **LLM-Wiki** 思想，搭建一个本地化的个人股票与投研知识库。内容覆盖从理论介绍、工具对比，到可运行代码、Skill 定义的完整链路。

## 项目定位

- 当团队已经在 LangChain / LangGraph 上积累了大量工具与项目经验，又需要支持国内模型或在不同模型提供商之间灵活切换时，**Deepagents** 是 Claude Agent SDK 之外的一个开放、可移植的 Agent Harness 选择。
- 借助 Andrej Karpathy 提出的 **LLM-Wiki** 思想，可以让 AI 持续"编译"原始资料（券商研报、财报）为一个互相链接、结构化的 Markdown 知识网络，复利积累投研判断。

## 目录结构

```
Deepagents/
├── 1. Deepagens.md            # Deepagents 介绍：与 Claude Agent SDK、LangChain、LangGraph 的关系
├── 2. LLM-Wiki.md             # LLM-Wiki 思想：raw / wiki / schema 三层架构
├── 3. Wiki-Action.md          # 实战：创建 Skill、构建 Harness Agent、markitdown 使用
├── LangGraph/                 # LangGraph 基础示例（Deepagents 的运行时依赖）
│   ├── LangGraph.md
│   └── langgraph-demo/
├── demo/                      # 可运行代码
│   ├── hello.py               # 最小可运行的 DeepAgent
│   ├── llm-wiki-agent.py      # 基于 Deepagents 构建的投研 Wiki Agent
│   └── pyproject.toml
├── data/                      # 知识库数据根目录
│   ├── raw/                   # 原始资料（PDF + markitdown 转出的 Markdown）
│   ├── wiki/                  # LLM 维护的结构化 Wiki 页面
│   ├── schema.md              # Wiki 组织规则
│   └── .llm-wiki/             # 健康报告、待处理队列等 LLM 工作区
└── .claude/
    └── skills/llm-wiki/       # llm-wiki Skill 定义（references / templates / scripts）
```

## 核心内容

### 1. Deepagents 是什么

Deepagents 是 LangChain 团队推出的 Agent Harness，底层基于 LangChain 组件与 LangGraph 运行时，向上封装了与 Claude Agent SDK 相似的"开箱即用"能力：

- **执行环境**：工具调用、虚拟文件系统、可选沙箱、代码解释器
- **上下文管理**：Skills、Memory、自动摘要、上下文卸载、提示缓存
- **任务委托**：内置 `write_todos` 做规划、内置 `task` 工具派生子代理
- **人机协同**：`interrupt_on` 在关键操作前暂停等待确认
- **权限控制**：通过 `permissions` 限制工具可访问的路径与操作

### 2. 三层架构与 LangChain 家族关系

| 层 | 角色 | 类比 |
|----|------|------|
| LangChain | Agent 的"零件库" | 乐高积木 |
| LangGraph | Agent 的"发动机" | 状态图、持久化、人机协同 |
| Deepagents | Agent Harness 实现 | 把零件和发动机封装成可直接驾驶的车 |

Deepagents 和 Claude Agent SDK 处于同一层，都回答同一个问题：如何把一个大语言模型变成一个能在真实环境里完成复杂任务的 Agent。

### 3. LLM-Wiki 三层架构

```
data/
├── raw/      # 只读层：原始资料（PDF 转 Markdown）
├── wiki/     # 读写层：LLM 维护的结构化 Markdown 知识库
└── schema.md # 规则层：Wiki 组织规则（人与 AI 共创）
```

- `raw/` 保留"证据"，所有结论都可回溯
- `wiki/` 由 AI 根据 schema 持续编译，支持 Wikilink 互引
- `schema.md` 是真理之源，决定页面类型、命名、字段、章节顺序

页面类型包括：个股档案、行业综述、宏观/概念、资料摘要、策略/复盘。

## 快速开始

### 环境要求

- Python >= 3.13
- [uv](https://docs.astral.sh/uv/)（推荐）或 pip
- 一个兼容 OpenAI SDK 的模型服务（或 DeepSeek 等）

### 安装

```bash
cd demo
uv sync
```

### 配置环境变量

在 `demo/.env` 中配置模型 API Key：

```
MINIMAX_API_KEY=your-api-key
```

### 运行最小示例

```bash
cd demo
uv run python hello.py
```

预期输出：DeepAgent 列出当前目录下的文件。

### 运行投研 Wiki Agent

```bash
cd demo
uv run python llm-wiki-agent.py
```

默认提示词：生成科大讯飞 SZ002230 的 2025 年金融研报。Agent 会自动调用 `llm-wiki` Skill，按 schema 规范生成个股页、行业页、宏观页等结构化 Wiki 内容。

### 导入资料到 Wiki

```bash
# 1. 把 PDF 放到 data/raw/ 下
# 2. 调用 markitdown 转换为 Markdown
bash .claude/skills/llm-wiki/scripts/import_pdf.sh <file>.pdf

# 3. 在 Claude Code 中让 LLM 处理
# > 帮我把 data/raw/<file>.md 导入到 wiki
```

### 健康检查

```bash
bash .claude/skills/llm-wiki/scripts/health_check.sh
```

会扫描 wiki 中的断链、矛盾标注、过期资料，汇总写入 `data/.llm-wiki/health-report.md`。

## 技术栈

- [Deepagents](https://github.com/langchain-ai/deepagents) >= 0.7.5 — Agent Harness
- [LangChain](https://github.com/langchain-ai/langchain) — 模型接口与组件
- [LangGraph](https://github.com/langchain-ai/langgraph) — 运行时与状态图
- [markitdown](https://github.com/microsoft/markitdown) — PDF/Office → Markdown 转换

## 阅读顺序建议

1. `1. Deepagens.md` — 理解 Deepagents 是什么、为什么需要它
2. `2. LLM-Wiki.md` — 理解 LLM-Wiki 思想与三层架构
3. `LangGraph/LangGraph.md` — 了解 LangGraph 基础
4. `3. Wiki-Action.md` — 实战：如何基于 Deepagents 构建 LLM-Wiki Agent
5. `demo/` — 看可运行代码
6. `.claude/skills/llm-wiki/SKILL.md` — 了解 Skill 的具体定义与触发场景

## 关联项目

- [ClaudeAgentSDK](../ClaudeAgentSDK/) — 同层的另一个 Agent Harness（与 Claude 模型深度绑定）
- [Smolagents](../Smolagents/) — 轻量级 Agent 框架对比
- [pimono](../pimono/) — 个人投研辅助工具
- [dsh](../dsh/) — DSH 项目实战文档
