# Claude Agent SDK Demo

配套 [Claude Agent SDK 教程](../) 的可运行示例工程，以「A 股上市公司投资分析报告」为业务场景，逐步演示 Claude Agent SDK 的核心能力：

| 示例 | 演示内容 | 对应教程 |
|---|---|---|
| `claudesdk1.py` | `query()` —— 最简 Agent Loop | [1. Claude Agent SDK.md](../1.%20Claude%20Agent%20SDK.md) |
| `claudesdk2.py` | `ClaudeSDKClient` —— 可扩展的会话式 Agent | [1. Claude Agent SDK.md](../1.%20Claude%20Agent%20SDK.md) |
| `claudesdkwithtool.py` | 自定义 MCP 工具（akshare 抓取财务数据） | [1. Claude Agent SDK.md](../1.%20Claude%20Agent%20SDK.md) |
| `claudesdkwithskill.py` | 加载 Skill 完成同样的任务 | [2. Skill.md](../2.%20Skill.md) |
| `multiagent.py` | SubAgent 多 Agent 协作（财报分析 + 风险预警） | [3. Multi-Agent.md](../3.%20Multi-Agent.md) |

示例统一接入 MiniMax 的 Anthropic 兼容接口，无需 Claude 官方账号即可运行。

---

## 环境要求

- Python 3.13+（见 `.python-version`）
- [uv](https://docs.astral.sh/uv/) 包管理器
- 一个支持 Anthropic API 协议的模型 API Key（默认使用 MiniMax）

## 快速开始

```bash
cd demo
uv sync                       # 安装 claude-agent-sdk / akshare / mcp
export OPEN_AI_API_KEY=<你的模型 API Key>
uv run claudesdk1.py
```

所有脚本在文件开头统一注入环境变量：

```python
os.environ.setdefault("ANTHROPIC_BASE_URL", "https://api.minimaxi.com/anthropic")
os.environ.setdefault("ANTHROPIC_MODEL", "MiniMax-M3")
os.environ.setdefault("ANTHROPIC_SMALL_FAST_MODEL", "MiniMax-M3")
os.environ.setdefault("ANTHROPIC_API_KEY", os.getenv("OPEN_AI_API_KEY"))
```

换成 Kimi、DeepSeek 等其他模型时，只需替换 `ANTHROPIC_BASE_URL` 与 `ANTHROPIC_MODEL`。

> 脚本读取的是 `OPEN_AI_API_KEY`，且没有调用 `load_dotenv()`，因此需要直接 `export` 到 shell 环境中；如果想用 `.env`，需自行引入 `python-dotenv` 并调用 `load_dotenv()`。

---

## 目录结构

```
demo/
├── claudesdk1.py               # query() 最简示例
├── claudesdk2.py               # ClaudeSDKClient 最简示例
├── claudesdkwithtool.py        # 自定义工具 + create_sdk_mcp_server
├── claudesdkwithskill.py       # skills="all" 加载技能
├── multiagent.py               # AgentDefinition 定义 SubAgent
├── tools/                      # 自定义工具实现
│   ├── get_balance_sheet_A_tool.py
│   └── test_get_balance_sheetA.py   # 脱离 SDK 单独验证 akshare 抓数
├── .claude/skills/             # 本地自研 Skill
│   └── financial_data_collection/
├── .agents/skills/             # 从 ClawHub 安装的第三方 Skill
│   ├── financial-report-analyzer/
│   └── a-share-risk-alert/
├── skills-lock.json            # 第三方 Skill 的来源与哈希锁定
└── data/financial_statements/  # 运行产物（已 gitignore）
```

---

## 逐个示例说明

### 1. `claudesdk1.py` —— `query()`

一次性提问，异步迭代拿到消息流。`query()` 是最高度封装的 Agent Loop，适合无状态的单轮任务。

```bash
uv run claudesdk1.py
```

### 2. `claudesdk2.py` —— `ClaudeSDKClient`

用 `async with` 管理一个持续的会话客户端，可多次 `query()`，会话上下文自动保留（见 [4. Session.md](../4.%20Session.md)）。自定义工具、Hooks 等能力都依赖这种写法。

```bash
uv run claudesdk2.py
```

### 3. `claudesdkwithtool.py` —— 自定义工具

`tools/get_balance_sheet_A_tool.py` 用 `@tool` 装饰器封装了一个通过 akshare 抓取沪深 A 股资产负债表的工具。**关键设计：工具把数据落盘成 CSV，只把文件路径返回给模型**，避免整张报表挤占上下文窗口。

```python
server = create_sdk_mcp_server(name="financial-tools", version="1.0.0", tools=[get_balance_sheet_A])

options = ClaudeAgentOptions(
    mcp_servers={"tools": server},
    allowed_tools=["mcp__tools__getbalance"],   # mcp__{server key}__{tool name}
)
```

```bash
uv run claudesdkwithtool.py
```

想跳过 SDK 单独验证抓数逻辑，可直接运行 `uv run tools/test_get_balance_sheetA.py`。

### 4. `claudesdkwithskill.py` —— Skill

同样的任务改用 Skill 完成：`skills="all"` 会自动加载工程内的技能目录，模型根据 `SKILL.md` 的 `description` 自行判断何时调用，并用内置的 `Bash` / `Read` / `Write` 工具执行技能脚本。

```bash
uv run claudesdkwithskill.py
```

本工程包含的 Skill：

| Skill | 位置 | 能力 |
|---|---|---|
| `financial_data_collection` | `.claude/skills/` | akshare 采集三大报表 + 财务指标，并可生成中文 PDF 年报 |
| `financial-report-analyzer` | `.agents/skills/` | 借助 SoMark 解析 PDF 财报后做结构化分析（需 `SOMARK_API_KEY`） |
| `a-share-risk-alert` | `.agents/skills/` | ST / 退市 / 财务造假等风险信号排查 |

`.agents/skills/` 下的两个 Skill 来自 [ClawHub](https://clawhub.ai)，其来源与内容哈希记录在 `skills-lock.json` 中。

### 5. `multiagent.py` —— 多 Agent 协作

用 `AgentDefinition` 定义两个 SubAgent，各自拥有独立的 prompt、工具集与上下文，由主 Agent 按任务分派并汇总结果：

- `financial-analyzer`：读取年报 PDF 做财务分析
- `a-share-risk-alert`：做风险评级与规避建议

```bash
uv run multiagent.py
```

运行前请修改文件顶部的 `PDF_PATH` 为你本机的年报路径。两个 SubAgent 的 `skills=[...]` 目前是注释状态，从 ClawHub 安装对应 Skill 后可以取消注释启用。

> 该示例使用 `permission_mode="bypassPermissions"`，会跳过工具调用的人工确认，直接读写文件，请在可信目录下运行。

---

## 数据产物

`data/financial_statements/` 存放示例运行结果（该目录已在 `.gitignore` 中）：

```
002261_{2022..2025}_资产负债表.csv / 利润表.csv / 现金流量表.csv / 财务指标.csv
002261_collection_summary.json          # 采集结果汇总，便于检查完整性
002261_2025_annual_report.pdf           # Skill 生成的 PDF 年报
拓维信息_002261_投资分析报告.md          # multiagent.py 的最终产出
```

CSV 统一使用 `utf-8-sig` 编码，可被 Excel 直接打开。

---

## 注意事项

- **SDK 版本锁定 `0.1.62`**：更新版本改动了工具调用的 API 接口，接入国产模型时会报 `API Error: 400 bad request`。使用 Claude 官方模型可忽略该限制。
- **akshare 网络不稳定**：免费数据源近期偶发失败，工具内已做异常兜底；对稳定性有要求可换成 [Tushare](https://tushare.pro/)。
- **数据仅供学习**：所有分析结果由 AI 生成，不构成投资建议。
