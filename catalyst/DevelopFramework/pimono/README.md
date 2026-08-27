# pimono — 基于 Pi-mono 的合同审查 Agent 实战

> 本教程展示如何基于 TypeScript 脚手架 [Pi-mono](https://github.com/earendil-works/pi) 从零搭建一个生产级合同审查 Agent。每一章在前一章基础上递进，最终得到一个具备 **解析 → 分类 → 审查 → 安全护栏** 的完整运行时。

---

## 为什么是 Pi-mono

[Claude Agent SDK](../ClaudeAgentSDK/) 的 Harness 工程非常成熟（上下文管理、Skills、Hooks 开箱即用），但闭源带来三个痛点：

- 内部实现不可见，深度定制无从下手
- 国产模型兼容性问题只能等官方修复（我们就曾被迫退回到 0.1.62 版本）
- 跨 Provider 协议适配需要自己写一层

走出 Python 技术栈，TypeScript 脚手架 **Pi-mono** 是一个更好的选择：源码就在你眼前，每一层设计都清晰可扩展。

### Pi-mono 的四层架构

```
┌──────────────────────────────────────────────────────────┐
│  pi-tui             终端 UI 渲染引擎（差分渲染）           │
├──────────────────────────────────────────────────────────┤
│  pi-coding-agent    面向应用开发者的 SDK 层                │
│                      · AgentSession · 持久化 · 压缩        │
│                      · 自动重试 · 扩展加载 · 内置工具集     │
├──────────────────────────────────────────────────────────┤
│  pi-agent_core      Agent 运行时（事件驱动）               │
│                      · Agent · AgentLoop · 事件订阅        │
│                      · steering / followUp                │
├──────────────────────────────────────────────────────────┤
│  pi-ai              统一 AI 层                             │
│                      · 屏蔽 Anthropic / OpenAI / Google    │
│                        / Bedrock 协议差异                  │
│                      · Model · Context · Message 抽象     │
└──────────────────────────────────────────────────────────┘
```

**调试定位速记**：
- 模型调用问题 → 看 `pi-ai`
- 循环逻辑问题 → 看 `pi-agent-core`
- 业务封装问题 → 看 `pi-coding-agent`
- 界面问题 → 看 `pi-tui`

### `Agent` vs `AgentSession`

| 概念 | 所在包 | 职责 |
| --- | --- | --- |
| **Agent** | `@earendil-works/pi-agent-core` | 底层 Agent 运行时：给定 system prompt / messages / tools，与 LLM 循环交互 |
| **AgentSession** | `@earendil-works/pi-coding-agent` | 高层封装：会话持久化、上下文压缩 (`compact()`)、自动重试、扩展绑定、默认工具集、steering/followUp 队列 |

> 业务代码中通常直接操作 `AgentSession`，需要深度定制循环时才下沉到 `Agent`。可通过 `session.agent` 访问底层 Agent。

---

## 教程目录

本教程共四章，循序渐进地构建一个合同审查 Agent：

| 章节 | 主题 | 关键产出 |
| --- | --- | --- |
| [1. pimono](./1.%20pimono.md) | 框架选型 + 最小的 Runtime | `createAgentSession()` 跑通 Agent Loop；理解 `.pi-agent/` 与 `.pi-sessions/` 目录 |
| [2. contract parse and classsify](./2.%20contract%20parse%20and%20classsify.md) | 自定义工具：解析 + 分类 | `parse_contract` / `classify_contract`；理解 `AgentToolResult` 的 `content` vs `details` |
| [3. toskill](./3.%20toskill.md) | 把业务方法论封装为 Skill | `contract-risk-review` Skill；大合同分块审查 + JSON 聚合 |
| [4. safety](./4.%20safety.md) | 多层安全护栏 | 5 条护栏规则：危险命令 / 敏感信息 / Web 白名单 / 文件访问 / 成本限制 |

---

## 项目结构

```
pimono/
├── 1. pimono.md                   # 第 1 章：选型 + 最小 Runtime
├── 2. contract parse and classsify.md   # 第 2 章：自定义工具
├── 3. toskill.md                  # 第 3 章：Skill 化
├── 4. safety.md                   # 第 4 章：安全护栏
├── assets/                        # 教程插图
└── contract-review-agent/         # 完整工程代码
    ├── package.json
    ├── tsconfig.json              # moduleResolution: nodenext
    ├── .env.local                 # MINIMAX_CN_API_KEY 等
    ├── simple-contract.txt        # 示例合同（含敏感信息）
    └── src/
        ├── runtime/
        │   ├── minimal.ts         # 第 1 章：最小 Runtime
        │   ├── with-tools.ts      # 第 2 章：挂载解析 + 分类工具
        │   ├── with-skill.ts      # 第 3 章：Skill 驱动的分块审查
        │   └── with-safety.ts     # 第 4 章：挂载安全护栏扩展
        ├── tools/
        │   ├── contract-parse-tool.ts      # .docx / .pdf / .txt → 纯文本
        │   └── contract-classify-tool.ts   # 启发式 + LLM 分类
        ├── core/
        │   ├── chunker.ts                  # 按章节边界分块
        │   ├── risk-scorer.ts              # 总体评分 A/B/C/D
        │   └── types/contract.ts           # RiskLevel / RiskType / RiskItem
        ├── review/
        │   └── skill-chunked-review.ts     # 分块审查 + JSON 聚合
        ├── guard/
        │   └── guards.ts                   # 5 条护栏规则 + 审计日志
        ├── extensions/
        │   └── security-guard.ts           # 护栏扩展（Pi-mono 标准发现机制加载）
        └── .claude/skills/contract-risk-review/   # 业务 Skill
            ├── SKILL.md
            └── references/
                ├── risk-clauses.md
                ├── contract-templates.md
                ├── legal-regulations.md
                └── revision-suggestions.md
```

---

## 快速开始

### 环境要求

- Node.js 18+
- pnpm（推荐）

### 安装

```bash
cd contract-review-agent
pnpm install
```

### 配置环境变量

在 `contract-review-agent/.env.local` 中填入模型 Provider 的 API Key：

```env
MINIMAX_CN_API_KEY=your-api-key
```

支持的模型和环境变量可参考 [pi-ai supported providers](https://github.com/earendil-works/pi/tree/main/packages/ai#supported-providers)。

> 如果使用不在 Pi 内置列表中、但兼容 OpenAI 接口的模型，可以自己构造 `Model` 对象传入 `createAgentSession()`。详见 [1. pimono.md](./1.%20pimono.md)。

### 运行各章节示例

```bash
# 第 1 章：最小 Runtime（Agent Loop）
npx tsx src/runtime/minimal.ts

# 第 2 章：解析 + 分类 + 审查
npx tsx src/runtime/with-tools.ts

# 第 3 章：Skill 驱动的分块审查
npx tsx src/runtime/with-skill.ts

# 第 4 章：安全护栏
npx tsx src/runtime/with-safety.ts
```

---

## 关键设计

### 1. Runtime 生成的目录

`createAgentSession()` 首次运行会在 `cwd` 下创建两个目录：

| 目录 | 作用 | 是否进版本库 |
| --- | --- | --- |
| **`.pi-agent/`** | Agent 全局配置：`auth.json`（Provider 凭据，加密落盘）、`models-store.json`（模型白名单）、扩展 / Skill / 提示模板等 | 否 |
| **`.pi-sessions/`** | 会话持久化：每次启动一个 `<ISO时间戳>_<uuid>.jsonl` 文件，逐行追加 `session` / `message` / `tool_result` / `compaction` 等事件 | 否（仅本项目为了排查护栏拦截保留） |

> 两个目录都是本地可重建的产物，生产场景建议加入 `.gitignore`。

### 2. `AgentToolResult` 的双层结构

```ts
return {
  content: [{ type: "text", text: "..." }],   // 给 LLM 看的简短文字
  details: { filePath, format, charCount, text }, // 给程序用的结构化数据
};
```

- `content` 决定模型的下一步推理
- `details` 可被后续工具或扩展读取，实现"结构化输出"

### 3. 工具 → Skill 的演进

业务逻辑最初写在 TypeScript 里（6 类风险定义、评分规则、输出格式）。当业务方法论变化（风险分类调整、评分规则变化），改代码成本太高。

把 **业务规则** 沉淀到 Skill，把 **工程逻辑** 留在代码里：

| 放进 Skill | 留在代码里 |
| --- | --- |
| 风险类型定义、识别要点、典型案例 | 解析 docx/pdf/txt 文件 |
| 审查步骤、输出格式 | 按章节切分大合同 |
| 评分规则 | 调用 Skill 审查每一块 |
| 替代文本模板 | 聚合各块结果 |

### 4. 安全护栏管道

Pi-mono 提供 `pi.on("tool_call", handler)` 事件拦截机制。我们把 5 条规则抽象成统一管道：

```ts
const guards: GuardRule[] = [
  dangerousCommandGuard,    // rm -rf、curl | sh、sudo
  webFetchWhitelistGuard,   // gov.cn / court.gov.cn / tianyancha 等
  sensitiveContentGuard,    // 正则初筛 + LLM 二次确认
  fileAccessGuard,          // 禁止读 .ssh / .env 等，限制在项目目录内
  costLimitGuard,           // 超过 Token 预算即阻断
];
```

护栏作为 **Pi-mono 扩展** 注册，通过 `DefaultResourceLoader.additionalExtensionPaths` 由标准发现机制加载，等价于 `~/.pi/agent/extensions/` 下的扩展文件。

---

## 后续可扩展方向

- **更多文件格式**：当前 `parse_contract` 支持 docx/pdf/txt，可扩展扫描件 OCR（接入 PaddleOCR / Tesseract）
- **多 Agent 协作**：拆分为「法务初审 Agent」+「合规复核 Agent」，对照两份报告
- **审查报告生成**：把 `RiskItem[]` 渲染成 Word/PDF 报告（含批注回写）
- **历史回归**：把每次审查的 `RiskItem[]` 落库，统计高发风险类型，沉淀企业级合同标准模板

---

## 参考

- [Pi-mono 仓库](https://github.com/earendil-works/pi)
- [pi-ai supported providers](https://github.com/earendil-works/pi/tree/main/packages/ai#supported-providers)
- [Claude Agent SDK 教程](../ClaudeAgentSDK/)
