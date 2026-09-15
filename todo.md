# LLM-Tutorials 仓库过时内容优化清单

> 生成时间：2026-09-15
> 范围：application / theory / openai-learning / catalyst / drawing / README.md
> 原则：严重（链接失效/关键事实错误）→ 中等（版本陈旧）→ 轻微（拼写/可读性）

---

## 🔴 P0 - 严重（链接失效、关键事实错误、协议已变更）

> **状态**：P0 全部 9 项已于 2026-09-15 修复完成（commit `10f212f`）。

### ✅ 1. A2A 仓库地址已迁移
- **文件**：`catalyst/Agent/6. A2A.md`、`catalyst/Agent/a2a-demo/README.md`
- **现状**：仓库仍引用 `google/A2A`，已 301 重定向到 `a2aproject/A2A`；文档站 `google.github.io/A2A` 已迁移
- **动作**：批量替换为 `https://github.com/a2aproject/A2A`，同步更新 `references` 与 `agent-card.json` 路径（2025 下半年 `.well-known/agent.json` → `.well-known/agent-card.json`）

### ✅ 2. OpenClaw 描述错误
- **文件**：`catalyst/OpenClaw/installation.md`、`catalyst/OpenClaw/skills.md`
- **现状**：文中暗示 OpenClaw 与 Anaconda 有关（`anaconda.com/openclaw` 404），实际 OpenClaw Foundation 是独立非营利组织；`qclaw.qq.com` 是腾讯侧的封装
- **动作**：澄清 OpenClaw 性质，删除"Anaconda"误导；明确 qclaw 仅为腾讯封装产品

### ✅ 3. MCP 传输层描述过期
- **文件**：`catalyst/Agent/5. MCP的通信方式.md`、`catalyst/LLMEngineering/AIWorkflow/12. Claude Code with MCP.md`
- **现状**：把 stdio 与 SSE 并列为当前推荐传输，但 2025 年 MCP 规范已将 **Streamable HTTP** 作为推荐传输，SSE 标记为 deprecated
- **动作**：补 Streamable HTTP 章节，标注 SSE 已废弃并给出迁移路径

### ✅ 4. A2A 协议版本（0.x → 1.0）
- **文件**：`catalyst/Agent/6. A2A.md`、`a2a-demo/`
- **现状**：示例使用 0.x 草案的 `sendSubscribe`/`subscribe`、`TaskState.input-required` 写法
- **动作**：对齐 A2A v1.0（`submitted/working/completed/failed/cancelled/input-required`）

### ✅ 5. ChatGPTNextWeb 仓库迁移
- **文件**：`README.md:124-125`、`openai-learning/1. GPT.md:79-81`
- **现状**：`ChatGPTNextWeb/ChatGPTNextWeb` 已迁移/重命名为 `ChatGPTNextWeb/NextChat`
- **动作**：替换为新仓库地址

### ✅ 6. openai-learning 大量 Python 代码使用 OpenAI 0.x 旧 API
- **文件**：
  - `1. hello/hello_openai.py`（`openai.Completion.create(engine=...)`）
  - `2. Embedding/a.get_dataset_embeddings.py / b.classifier_with_embedding.py / c.comment_analysis.py`（`from openai.embeddings_utils import ...`）
  - `3. completion/*.py`（全局 `openai.api_key` + `openai.Completion/ChatCompletion.create`）
  - `5. aggregation/*.py`（同上）
  - `10. Fine-tune/story.py`（`openai api fine_tunes.*` CLI 已下线）
  - `12. whisper/whisper.md`（`openai.Audio.transcribe` 旧写法）
  - `openai-engines/get_openai_engines.py`（`openai.Engine.list()` 已移除）
- **现状**：openai>=1.0 移除所有顶层全局 API，无法直接运行
- **动作**：批量迁移到 `from openai import OpenAI; client = OpenAI(); client.chat.completions.create(...)`；将 `text-embedding-ada-002` → `text-embedding-3-small`、模型改为 `gpt-4o-mini`/`gpt-4.1-mini`

### ✅ 7. llama-index 旧 API（0.5.x）
- **文件**：`openai-learning/8. llama-index/*.py`
- **现状**：`GPTSimpleVectorIndex`、`GPTListIndex`、`LLMPredictor`、`ServiceContext` 等 0.5.x API 已删除
- **动作**：迁移到 `VectorStoreIndex`、`SummaryIndex`、`LLM`、`Settings`（0.9+）；或加迁移说明

### ✅ 8. Cursor 定价信息过时
- **文件**：`application/2. Coding with GPT.md:65`
- **现状**："目前是20美金/月" 与当前 Cursor 实际定价（多档订阅）不符
- **动作**：删除或更新为当前价格

### ✅ 9. Civitai 平台现状描述
- **文件**：`drawing/Stable-Diffusion/Civitai and Hugging Face.md`、`drawing/Stable-Diffusion/1. WebUI.md`
- **现状**：Civitai 经历 2024-2025 多次访问风波与商业转向，描述过于乐观
- **动作**：补充现状说明

---

## 🟡 P1 - 中等（版本陈旧、需更新模型/SDK 推荐）

> **状态**：P1 全部 10 项（11-20；21 已在 P0-4 处理）于 2026-09-15 修复完成。

### ✅ 11. Ollama 推荐模型过时
- **文件**：`catalyst/ollama/ollama.md`、`catalyst/ollama/实战1：本地部署7B模型辅助编码.md`
- **现状**：`llama2`、`llama2-chinese`、`codellama:7b`（最近 commit 改为 `ornith-1.5:9b`）均非 2026 推荐；32B 量化模型在 16GB+ Mac 已可流畅运行
- **动作**：推荐 `qwen2.5-coder:32b` / `qwen3-coder:30b` / `deepseek-coder-v2`；更新 num_ctx 默认值

### ✅ 12. Claude Code 默认模型与实验开关
- **文件**：`catalyst/LLMEngineering/AIWorkflow/4. Claude Code installation.md`、`24. Agent Teams.md`
- **现状**：默认模型 `claude-sonnet-4-5-20250929`、`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`、`claude mcp add --transport sse` 均为 2025 早期写法
- **动作**：更新到 Claude 4.6/4.7 系列；核对 Agent Teams 当前开关名；`--transport` 默认 streamable-http

### ✅ 13. Claude Agent SDK 版本锁定
- **文件**：`catalyst/DevelopFramework/ClaudeAgentSDK/1. Claude Agent SDK.md`、`agnet-framework-history.md`
- **现状**：硬编码 `claude-agent-sdk==0.1.62`，2026-09 已迭代到 0.3+/0.4+
- **动作**：明确这是兼容国产模型的临时回退；提供回升级路径

### ✅ 14. Smolagents / Deepagents API 路径变更
- **文件**：`catalyst/DevelopFramework/Smolagents/1. CodeAct.md`、`2. Usage.md`、`catalyst/DevelopFramework/Deepagents/1. Deepagens.md`
- **现状**：`OpenAIModel` → `LiteLLMModel`、`from Deepagents` → `from deepagents`（小写）、`claude-sonnet-4-6` 已升级
- **动作**：修正 import 路径与模型 ID

### ✅ 15. Embedding 模型推荐过时
- **文件**：`catalyst/Vector Store/advanced/TextEmbedding.md`、`catalyst/Agent/2. 黄焖鸡点餐例子.md`
- **现状**：`all-MiniLM-L6-v2`、`BAAI/bge-base-en-v1.5`、`bert-base-uncased` 处理中文菜单；`text-embedding-v1` 已下线
- **动作**：推荐 `bge-m3`、`nomic-embed-text-v2`、`bge-large-zh-v1.5`、`text-embedding-v3/v4`

### ✅ 16. RedisAI 已弃用
- **文件**：`catalyst/Vector Store/advanced/常用向量数据库.md`
- **现状**：仍写 "RedisAI"，2024 年被 Redis 官方弃用，现 Redis 8 内置向量能力
- **动作**：改为 Redis 8 / `redis-stack`

### ✅ 17. Midjourney 版本演进
- **文件**：`drawing/Midjourney/1. Midjourney.md`、`6. some prompts.md`、`2. prompt basic.md`、`3. prompt role consistency.md`、`5. prompt meme.md`、`8. 双角色一致.md`
- **现状**：参数 `--v 5`、`--v 5.2`、`--niji 5`；v7 已发布且为默认；`--oref` 已覆盖双角色一致性
- **动作**：统一到 v6/v7，`8. 双角色一致.md` 补充 `--oref` 多角色方案

### ✅ 18. SD 主线仍是 A1111
- **文件**：`drawing/Stable-Diffusion/1. WebUI.md`、`README.md:60`
- **现状**：主线介绍 A1111，仓库已停滞；主流已转向 Forge/reForge/SD.Next；SD3/Flux/Wan/Qwen-Image 等新一代架构未提及
- **动作**：补充 Forge、reForge、SD.Next；新增 SD3/Flux/Wan 章节

### ✅ 19. Stable Diffusion advice.md 错误信息
- **文件**：`drawing/Stable-Diffusion/advice.md:22`
- **现状**："目前的 ChatGPT 并不懂 2022 年以后的技术（比如 DALL-E 2、Stable Diffusion）" — GPT-4o 已支持原生图像生成
- **动作**：重写整段

### ✅ 20. dsh/multi-model-config 第三方包时效
- **文件**：`catalyst/LLMEngineering/AIWorkflow/Appendix3-multi-model-config.md`
- **现状**：`cc-manager`、`cc-switch-config`、`@wcldyx/claude-code-switcher` 部分已停止维护
- **动作**：建议使用 Claude Code 原生 `/model`、`--model`；社区工具加时效提示

### ✅ 21. A2A 示例状态枚举
- **文件**：`catalyst/Agent/6. A2A.md` 与 `a2a-demo`
- **现状**：`TaskState` 包含非规范化的状态
- **动作**：对齐 v1.0 状态枚举

---

## 🟢 P2 - 轻微（拼写、可读性、风格）

> **状态**：P2 全部 6 项（22-27）于 2026-09-15 修复完成。

### ✅ 22. 拼写/格式错误
- `catalyst/DevelopFramework/pimono/2. contract parse and classsify.md`：文件名 `constract-parse-tool.ts` 少一个 n
- `catalyst/DevelopFramework/ClaudeAgentSDK/1. Claude Agent SDK.md`、`agnet-framework-history.md`：`TpyeScript / TypeScirpt` 拼写错误
- `application/travel-assitant/2. 配置MiniMax语音MCP.md`：`MiniMax`（应为 MiniMax）；指向 `modelscope.cn/mcp/servers/@MiniMax-AI/MiniMax-MCP` 等失效链接
- `openai-learning/3. completion/completion.md:76`：锚点 `e.chang_text.py`（实际为 `e.change_text.py`）链接断裂
- `application/2. Coding with GPT.md:2`：标题写"用GPT帮助写代码"，但实际讲 DeepSeek/Cursor/Claude Code，前后不一致
- `openai-learning/2. platforms.md:7`：`Noteable123` 拼写异常（疑为 Noteable） — 文件已在 P0 整改时删除，no-op
- `drawing/Stable-Diffusion/3. image2image.md:20`："迪斯尼" → "迪士尼"

### ✅ 23. README 中描述与实际目录略有出入
- **README.md:42**：`ClaudeAgentSDK/` 未提新增的 `OpenTelemetry.md`、`assets/`
- **README.md:44**：`Deepagents/` 未提 `LangGraph/` 子目录
- **README.md:45**：`Smolagents/` 未提 `mcp_server/`、`tools/`
- **README.md:144**："2025+ 是 Harness 的年份" 已成 2026，应改为"2025-2026"

### ✅ 24. README 中第三方链接需核实
- **README.md:113**：`DjangoPeng/openai-quickstart` 个人仓库，建议改 OpenAI Cookbook
- **README.md:114**：飞书伪代码 Prompt 文档需加"可能失效"备注
- **README.md:118**：`aishort.top` 个人维护站点需核实

### ✅ 25. 代码风格/描述陈旧
- `openai-learning/12. whisper/whisper.md:62`：whisper 定价（0.006 美元/分钟）已多次调整
- `openai-learning/12. whisper/whisper.md:27`：提到 "Google PALM"（已被 Gemini 取代）
- `openai-learning/13. visual chatgpt/visual chatgpt.md:19`：`TaskMatrix` 仓库已 archive
- `application/4.1 AI Tutor.md`：`Mr.-Ranedeer-AI-Tutor` 已转付费
- `theory/4. ReAct.md:35`：`smith.langchain.com/hub/...` LangChain Hub URL 已迁移到 LangSmith Hub
- `catalyst/LLMEngineering/Harness/1. Harness是什么.md`：SWE-Agent 论文数据（3.97%→12.47%）是 GPT-4 时代
- `catalyst/DevelopFramework/ClaudeAgentSDK/2. Skill.md`、`3. Multi-Agent.md`：clawhub.ai 与具体 skill 链接未验证

### ✅ 26. qdrant-demo README 为空
- **文件**：`catalyst/Vector Store/qdrant/qdrant-demo/README.md`
- **现状**：文件存在但内容为 0 字节
- **动作**：补充 README 或在主 README 中移除该目录的引用

### ✅ 27. stock-analysis 代码注释错乱
- **文件**：`application/stock-analysis/get-stock-data-demo/get_stock_pre_build.py:13`
- **动作**：修复注释错乱

---

## 备注（无需修改，但需关注）

- `requirements.txt` 中 `openai==0.27.4`、`langchain==0.0.142`、`llama-index==0.5.18` 均已不可用；本任务不整体升级，但 todo 项 7/8 涉及的代码改造应同步更新依赖版本
- `openai-learning/README.md` 章节表未列 4、9、11，与目录实际相符（仅是选章呈现方式），保持现状
- 本清单采用"按问题类型汇总"，实际修改时建议按文件聚类，避免对同一文件反复 Edit
