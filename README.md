# LLM-Tutorials

个人整理的大模型学习与实战仓库，覆盖 **理论 → API → 应用 → Agent 框架** 的完整链路。

---

## 目录结构

```
LLM-Tutorials/
├── application/        # 调用大模型 API 实现的具体应用
├── catalyst/           # Agent、MCP、RAG、Vector Store 等进阶主题
├── drawing/            # AI 绘图（Stable Diffusion、Midjourney、CLIP）
├── openai-learning/    # OpenAI API 系列教程（1～13 章）
└── theory/             # 理论：Transformer、注意力机制、ReAct、微调、蒸馏
```

---

## 各模块导览

### `application/` — 应用层
基于大模型 API 落地的小项目与场景化示例：

| 子目录 / 文件 | 内容 |
|---|---|
| `json-stream-demo/` | JSON 流式响应（前端 SSE/Stream 解析） |
| `node-sse-demo/` | Node.js Server-Sent Events 实战 |
| `stock-analysis/` | 股票数据分析（`get-stock-data-demo/`） |
| `travel-assitant/` | 旅行助手对话应用 |
| `1. 用大模型生成设计稿.md` ~ `6. 视频转场技巧.md` | 场景化实战：用 GPT 写小说、写代码、提示词技巧、AI 导师、橘猫动画、视频转场等 |

### `catalyst/` — 进阶主题（Agent / RAG / 工程化）
仓库中体积最大、最活跃的部分，按子主题拆分：

- **`Agent/`** — Agent 与 MCP 核心概念
  - 基础：`1. 什么是Agent.md` → `7. Agent Design Patterns.md`
  - MCP 协议细节：`4. 什么是MCP.md`、`5. MCP的通信方式.md`、以及 `mcp细节/`
  - A2A 协议：`6. A2A.md`、`a2a-demo/`、`architecture/`
  - 设计模式：`design-patterns/`（Pattern-Advance、反向五步法等）
  - MCP 实战：`mcp-hello/`、`mcp-prompt-demo/`、`mcp-resource-demo/`、`mcp-samling-demo/`、`mcp-server-node-demo/`、`mcp-tool-demo/`
- **`DevelopFramework/`** — 主流 Agent 框架实战
  - `ClaudeAgentSDK/` — Claude Agent SDK + Skill + Multi-Agent + Hooks（含 `demo/`）
  - `Deepagents/` — Deepagents + LangGraph + LLM-Wiki 投研知识库（含 `demo/`、`data/`、`.claude/skills/`）
  - `Smolagents/` — HuggingFace Smolagents（CodeAct / ToolCalling / MCP，含 `demo/`）
  - `pimono/` — Pi-mono（TypeScript 脚手架）合同审查 Agent 实战（4 章教程 + `contract-review-agent/`）
  - `dsh/` — 自研插件框架示例（`hello-plugin/`、`scratch-plugin/`）
- **`LLMEngineering/`** — LLM 工程化与 Claude Code 工作流
  - `AIWorkflow/` — 24 章 Claude Code 实战工作流（Spec 开发、安全、MCP、Skills、Subagent、TDD、CI/CD、Agent Teams 等）
  - `Harness/` — 19 章自研 Agent Harness 教程（主循环、思考、工具注册、并行、子 Agent、可观测性、tracing、benchmark）+ `node-tiny-claw/` 实战
- **`OpenClaw/`** — OpenClaw 平台安装与 Skills 文档
- **`Vector Store/`** — 向量库与 RAG
  - `advanced/` — RAG 原理、GraphRAG、TextEmbedding、SentenceTransformers 中文分词、Word 文档入库方案、常用向量库对比
  - `qdrant/` — Qdrant 简介与 CRUD 示例 + `qdrant-demo/`
- **`ollama/`** — 本地部署：Ollama、llama.cpp、高可用架构、7B 编码助手实战

### `drawing/` — AI 绘图
- **`CLIP/`** — CLIP 图文匹配模型（`dog-or-cat.py` 分类示例）
- **`Midjourney/`** — Midjourney 提示词技巧：基础、角色一致性、故事化、表情包、双角色一致性、复杂场景
- **`Stable-Diffusion/`** — SD 全套：WebUI / ComfyUI Workflow（text2image、image2image、upscale）、提示词、img2img、Diffusion/UNet/Sampler/VAE 原理、Civitai & HuggingFace、SD1.5 vs SDXL 对比

### `openai-learning/` — OpenAI API 系列教程
按章节递进，每章一个独立小工程：

| 章节 | 主题 |
|---|---|
| `1. hello` | 第一个 OpenAI API 调用 |
| `2. Embedding` | 文本嵌入 + 评论分类 |
| `3. completion` | 补全：食物聊天机器人、翻译器、文本转换 |
| `5. aggregation` | Embedding + K-Means 文本聚类（20 newsgroups） |
| `6. moderate` | 内容审核 API |
| `7. search optimize` | 搜索排序优化 |
| `8. llama-index` | LlamaIndex RAG（含文章 + 图片阅读） |
| `10. Fine-tune` | 模型微调（story.py） |
| `12. whisper` | 语音识别 + GPT-SoVITS 声音克隆 |
| `13. visual chatgpt` | 多模态视觉对话 |

辅助目录：`evaluation/`（奖励模型）、`openai-engines/`（模型列表）

### `theory/` — 理论基石
- 根目录：Embedding、Attention、Transformer 架构（2.1/2.2）、Prompt 范式、ReAct、Vue 高级前端面试题
- **`Fine tuning/`** — 为什么微调、数据准备、模型训练、LLaMA-Factory 使用
- **`deepseek/`** — DeepSeek 蒸馏技术（原理 + 实战）

---

## 学习路径建议

> 对应三步走：Agent → Skill → Harness

1. **Agent 开发**
   - 基础：`openai-learning/` 系列 → `application/` 场景实战
   - Agent 与 MCP：`catalyst/Agent/`（核心概念 → 协议细节 → 各 demo）
   - 主流框架：`catalyst/DevelopFramework/`（任选 ClaudeAgentSDK / Deepagents / Smolagents / Pi-mono 深入）
   - RAG 基础：`catalyst/Vector Store/`
2. **Skill 开发**
   - 业务方法论沉淀：`catalyst/DevelopFramework/ClaudeAgentSDK/2. Skill.md`、`pimono/3. toskill.md`
   - 实战范式：`catalyst/DevelopFramework/Deepagents/` 的 llm-wiki Skill + `.claude/skills/`
3. **Harness**
   - 运行时原理与自研：`catalyst/LLMEngineering/Harness/`（19 章主循环 → 工具注册 → 并行 → 子 Agent → Tracing）
   - Claude Code 团队协作流程：`catalyst/LLMEngineering/AIWorkflow/`（24 章 Spec / 安全 / CI/CD / Agent Teams）

---

## 提示词技巧

- **角色设定**：在 System 中给 GPT 设定角色与任务（如"哲学大师"）
- **指令注入**：在 System 中注入常驻任务（如"主题创作"）
- **问题拆解**：将复杂问题拆为子问题分步执行（Debug、多任务场景）
- **分层设计**：创作长篇内容，先概览、再章节、最后补充细节（小说生成）
- **编程思维**：把 Prompt 当编程语言，设计变量、模板与正文（用于评估模型输出质量）
- **Few-Shot**：基于样例约束推理路径与输出样式
- **Function Calling**：用工具调用优化 [Function Calling 示例](https://github.com/DjangoPeng/openai-quickstart/blob/main/openai_api/function_call.ipynb)
- **伪代码 Prompt**：参考 [伪代码提示词飞书文档](https://waytoagi.feishu.cn/wiki/MjUDwTbq9iUtBrkskPXcpfOHnPg)
  - 优点：精确控制逻辑、节省 token
  - 缺点：需要懂代码、直观性受损

推荐社区：[AI Short 提示词社区](https://www.aishort.top/)

---

## 工具与平台

- **ChatGPT-Next-Web**：自建 GPT 类应用（含 Claude / DeepSeek / GPT-4 / Gemini Pro 支持）
  → <https://github.com/ChatGPTNextWeb/ChatGPTNextWeb>
- **前端 AI 工具**：[v0 AI](https://v0.dev/) · [Open UI](https://github.com/wandb/openui)
- **编码插件**：通义灵码 · GitHub Copilot · DeepSeek

---

## 经验与教训

- **大模型开发 ≠ 传统开发**：传统开发是用代码复制人类逻辑，大模型开发是用数据让 AI 自主学到这个逻辑
- **应用层 vs 底层创新**：单纯套壳大模型很容易被模型迭代替代；要做大模型底层技术需要大量资金和人才。如果团队已有成熟业务，应优先用大模型改造现有业务；如果你是个人开发者，建议沿 **Agent → Skill → Harness** 这条路径深入，理解工程化能力才是长期护城河
- **真正价值在效率提升**：用户只为结果付费，且必须有可量化的效率/数据提升，这也是大模型厂商普遍亏损补贴的原因（如讯飞星火从送 200 万 token 升至 1 亿 token）
- **大模型要当员工对待**：做 AI 应用，就是要把大模型当人、当下属来管理
- **代码生成不完美**：大模型写代码并不完全可靠，需要人类持续监督与测试；但已经能承担至少 60% 的工作量
- **理论不能跳**：建议先理解 Attention、Transformer、Embedding 等基础原理，再深入应用与 Agent 框架

---

## 三步走：Agent → Skill → Harness

> 2025+ 是 Harness 的年份。模型能力趋同后，工程化能力（如何把模型用好）才是真正的护城河；模型微调已不再是个人开发者的优先路径。

1. **Agent 开发** —— Prompt 工程 + API 调用 + Agent 概念（ReAct / 工具调用）+ MCP 协议 + 主流框架上手（ClaudeAgentSDK / Deepagents / Smolagents / Pi-mono）
2. **Skill 开发** —— 把业务方法论沉淀为可复用的 Skill，让模型按 `description` 自行判断调用时机，业务规则与工程逻辑各居其位
3. **Harness 自研** —— 深入 Agent 运行时核心：主循环、上下文管理、工具注册、并行执行、子 Agent、可观测性、Trancing、安全护栏、成本控制
