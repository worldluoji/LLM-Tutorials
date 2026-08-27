# Smolagents Demo

本目录演示如何使用 **Smolagents** 框架从最简单的 Agent 起步，逐步接入自定义工具和 MCP 服务器。

## 项目定位

Smolagents 是 Hugging Face 推出的极简 Agent 框架，核心思路是 **CodeAct 模式**——让 LLM 直接生成可执行的 Python 代码片段来调用工具，而不是输出结构化的 JSON 工具调用参数。本目录通过 4 个递进的脚本，演示这一范式及其与传统 Tool Calling 的对比。

## 目录结构

```
demo/
├── 1hello.py              # 最简 CodeAgent：无工具，仅做数学计算
├── 2withtool.py           # CodeAgent + 自定义工具（CSV 分析 → Markdown 报告）
├── 3withmcp.py            # CodeAgent + 远程 MCP 服务器工具
├── 4toolcalling.py        # ToolCallingAgent 范式对比
├── tools/                 # 自定义 Tool 实现
│   ├── read_csv_tool.py   # 读取 CSV 并以 markdown 字符串返回
│   └── write_md_tool.py   # 把 Markdown 内容写入文件
├── mcp_server/            # MCP 服务器实现（与 tools/ 复用同一份 Tool 逻辑）
│   └── server.py
├── data/                  # 示例数据：燕京啤酒日 K 线 CSV
├── pyproject.toml         # 依赖声明（smolagents、mcp、claude-agent-sdk）
├── .env                   # 模型 API Key 配置
└── .venv/                 # uv 创建的虚拟环境
```

## 4 个示例的演进关系

| 脚本 | Agent 类型 | 工具来源 | 演示重点 |
|------|------------|----------|----------|
| `1hello.py` | `CodeAgent` | 无 | CodeAct 模式基线：LLM 直接生成 `sum(range(1, 101))` 这类 Python 代码 |
| `2withtool.py` | `CodeAgent` | 本地自定义 Tool（`tools/`） | 自定义 Tool 与 Agent 的集成方式 |
| `3withmcp.py` | `CodeAgent` | 远程 MCP 服务器（`mcp_server/`） | 工具从进程内变为进程外，Agent 用法不变 |
| `4toolcalling.py` | `ToolCallingAgent` | 无 | 与 CodeAct 对照：LLM 输出结构化 JSON 参数而非代码 |

## 快速开始

### 环境要求

- Python >= 3.13
- [uv](https://docs.astral.sh/uv/)（推荐）或 pip
- 一个兼容 OpenAI SDK 的模型服务

### 安装

```bash
uv sync
```

### 配置

复制或编辑 `.env`，填入兼容 OpenAI 协议的 API Key：

```bash
OPENAI_API_KEY=your-api-key
```

### 运行

```bash
# 1. 最简示例
uv run python 1hello.py

# 2. 自定义工具：CSV 分析 + 输出 Markdown 报告
uv run python 2withtool.py

# 3. MCP 服务器工具：先启动服务，再运行 Agent
uv run python mcp_server/server.py   # 监听 http://127.0.0.1:38000/mcp
uv run python 3withmcp.py

# 4. Tool Calling 范式对照
uv run python 4toolcalling.py
```

## 核心概念

### CodeAct 模式

`CodeAgent` 让 LLM 把"思考 + 行动"写成一段可执行的 Python 代码，而不是先选工具、再按 schema 填参数。例如对 `2withtool.py` 的任务，模型可能输出：

```python
content = read_csv(file_path="/path/to/yanjing_beer.csv", max_rows=100)
# ... 模型自行写代码做指标计算 ...
write_md(file_path="./report.md", content=summary)
```

优势：动作空间是完整的 Python，组合更灵活；代价：需要可信的代码执行环境（沙箱）。

### Tool Calling 模式

`ToolCallingAgent` 走的是传统路线：模型输出 `{tool, args}` 形式的 JSON，由框架解析后执行。对照见 `4toolcalling.py`：同一个简单求和任务，模型输出的是 `{"name": "calculator", "arguments": {...}}` 这样的结构。

### 自定义 Tool

`tools/read_csv_tool.py` 与 `tools/write_md_tool.py` 是最小的 Tool 示例，关键字段：

```python
class ReadCSVTool(Tool):
    name = "read_csv"                       # 工具名
    description = "..."                     # 模型用来判断何时调用
    inputs = {"file_path": {...}, ...}      # 参数 schema
    output_type = "string"

    def forward(self, file_path, max_rows=None):  # 实际逻辑
        ...
```

### MCP 集成

`mcp_server/server.py` 把同一个 `ReadCSVTool` / `WriteMDTool` 通过 [MCP](https://modelcontextprotocol.io/) 协议以 `streamable-http` 暴露到 `38000` 端口。Agent 侧仅需：

```python
with MCPClient({"url": "http://127.0.0.1:38000/mcp",
                "transport": "streamable-http"}) as tools:
    agent = CodeAgent(tools=tools, model=model, stream_outputs=False)
    agent.run("...")
```

MCPClient 在退出 `with` 块时自动清理资源。Tool 实现被进程外复用，说明同一份业务逻辑既可直接 import 给本地 Agent，也能以服务方式提供给其它 Agent / IDE。

## 数据说明

`data/yanjing_beer_daily_k_20250518_20260518.csv` 是燕京啤酒 2025-05-18 至 2026-05-18 的日 K 线数据（OHLCV），用于演示脚本中的 CSV 分析任务。
