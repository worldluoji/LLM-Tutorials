# MCP Streamable HTTP Demo

> 对应教程：[`../mcp细节/7. Streamable Http.md`](../mcp细节/7.%20Streamable%20Http.md)

用 FastMCP 搭建一个**最简可运行**的 Streamable HTTP MCP 服务端，并用两种客户端（SDK 高阶 API / 裸 HTTP）去连接它。重点演示：

- 单端点 `POST /mcp` 发 JSON-RPC
- `Mcp-Session-Id` 在有状态模式下的作用
- 服务器既可以返回 `application/json`，也可以返回 `text/event-stream`
- 长任务的进度通知（只有 SSE 流式响应里才看得到）
- 有状态 vs 无状态两种部署模式

---

## 目录结构

```
mcp-streamable-demo/
├── README.md                  # 本文件
├── server/
│   ├── pyproject.toml
│   └── main.py                # FastMCP 服务端：4 个工具 + 1 个资源
└── client/
    ├── pyproject.toml
    ├── streamable_client.py   # 方式一：用 mcp.client.streamable_http 高级 API
    └── raw_http_demo.py       # 方式二：用 httpx 发裸 HTTP，看清报文
```

---

## 准备

需要 Python ≥ 3.10，并安装 `uv`（推荐）。

在仓库根目录用 uv 工作区统一管理（如果有需要，也可以单独 cd 进 `server/` 或 `client/` 各自 `uv sync`，它们的依赖是分离的）。

---

## 跑起来

### 步骤 1：启动服务端（开两个终端）

**终端 A — 默认配置（有状态 + SSE 回包）：**
```bash
cd catalyst/Agent/mcp-streamable-demo/server
uv run main.py
```
输出大致：
```
[server] 启动中... mode=有状态 response=SSE url=http://127.0.0.1:8000/mcp
```

**终端 B — 可选：再起一个无状态实例，对比行为差异：**
```bash
cd catalyst/Agent/mcp-streamable-demo/server
uv run main.py --port 8001 --stateless
```

**参数说明：**

| 参数 | 默认 | 含义 |
|---|---|---|
| `--host` | `127.0.0.1` | 监听地址 |
| `--port` | `8000` | 监听端口 |
| `--stateless` | 关 | 无状态模式（无 `Mcp-Session-Id`，适合 Serverless） |
| `--json-response` | 关 | 工具调用强制返回 `application/json`，不走 SSE |

### 步骤 2：跑客户端

**方式 A — 高级 API（推荐入门）：**
```bash
cd catalyst/Agent/mcp-streamable-demo/client
uv run streamable_client.py
```
会依次：
1. 连接 `http://127.0.0.1:8000/mcp`
2. 打印 `Mcp-Session-Id`
3. 列出服务端暴露的工具
4. 调用 `add(2, 3)`、`get_weather('beijing')`、`slow_task(2.0)`

**方式 B — 裸 HTTP（推荐用来理解报文）：**
```bash
cd catalyst/Agent/mcp-streamable-demo/client
uv run raw_http_demo.py
```
会依次打印：
1. `initialize` 响应中的 `serverInfo` 和 `Mcp-Session-Id` 响应头
2. `notifications/initialized` 返回 `202 Accepted`
3. `tools/list` 的工具清单
4. `tools/call add(2,3)` 的回包（默认 SSE）
5. `tools/call slow_task(2.0)` 的多帧 SSE 输出
6. **故意不带 `Mcp-Session-Id` 调用 `add(1,1)`**，验证有状态模式会拒绝、无状态模式会放行

---

## 服务端工具一览

| 工具 | 用途 | 演示什么 |
|---|---|---|
| `add(a, b)` | 两数相加 | 最基础的瞬时调用 |
| `get_current_time()` | 当前 UTC 时间 | 无副作用、无参数 |
| `get_weather(city)` | 模拟天气 | 字符串参数演示 |
| `slow_task(seconds)` | 跑 N 秒并发进度通知 | **SSE 才能传 progress 通知** |
| `greeting://{name}` (resource) | 资源读取 | `resources/read` 的报文 |

---

## 客户端如何接入 Claude Code / Cursor / Roo Code？

把这台服务当成"远程 MCP 服务器"接入任意 MCP Host 即可（下面以 Claude Code 为例）：

```bash
claude mcp add --transport http streamable-demo http://127.0.0.1:8000/mcp
```

> `claude mcp add --transport http` 是 2025 下半年新增的参数（旧的 `--transport sse` 已不推荐）。
> 验证方式：进入 Claude Code 后输入 `/mcp`，能看到 `streamable-demo` 列出来即可。

---

## 跟文档的对照

| 文档章节 | 在 demo 里的体现 |
|---|---|
| 「为什么流行」单端点 | `server/main.py` 的 `streamable_http_path="/mcp"` |
| 「Accept 头必须同时包含 application/json 和 text/event-stream」 | `client/raw_http_demo.py` 的 `headers` 字典 |
| 「Mcp-Session-Id 会话」 | `raw_http_demo.py` 步骤 6 故意不带 session id 验证拒绝 |
| 「JSON 响应」 | 服务端加 `--json-response` 后，所有工具调用直接返回 `application/json` |
| 「SSE 流式响应」 | `slow_task` 推送 progress 通知；客户端通过 `streamablehttp_client` 自动解码 |
| 「无状态模式」 | 服务端加 `--stateless`；适合 Cloudflare Workers / Vercel / Lambda |
| 「有状态模式」 | 默认；可以走 `sampling`/`elicitation`/断线恢复等高级能力 |

---

## 实现时容易踩的坑（来自文档，已在 demo 中规避）

1. **Accept 头必须两个值都给** — SDK 默认会带；如果走裸 HTTP，自己别忘了。
2. **代理可能缓冲 SSE** — 生产环境记得给 Nginx/CDN 关掉 `X-Accel-Buffering`。
3. **CORS** — 浏览器接入时要放行 `Mcp-Session-Id`、`MCP-Protocol-Version`、`Last-Event-ID`。
4. **会话 ID 安全** — 不要把 `Mcp-Session-Id` 当自增 ID；服务端实现要随机、可过期、绑定用户。
5. **无状态 ≠ 全场景** — 需要 sampling、elicitation、断线恢复时，必须用有状态模式。

---

## 进阶实验

- 把 `slow_task(seconds=10)` 跑起来，同时用 `curl -N` 直接观察 SSE 流：
  ```bash
  curl -N -X POST http://127.0.0.1:8000/mcp \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: <从 initialize 拿到的 sid>" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"slow_task","arguments":{"seconds":10}}}'
  ```
- 改 `server/main.py` 加新工具，看 `tools/list` 输出变化
- 用 MCP Inspector 调试：
  ```bash
  uv run mcp dev server/main.py
  ```
  浏览器打开 `http://localhost:5173`，在 Transport 选项里选 **Streamable HTTP** 而不是 SSE。
