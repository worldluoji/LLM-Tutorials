这个业务案例，设计了一个文件系统助手，它利用 MCP 采样机制来增强用户与文件系统交互的能力。该助手能够回答用户关于文件系统状态和内容的问题，提供直观的文件管理支持。

为什么采用采样机制呢？主要是因为文件系统操作既需要专业知识，又需要安全保障。通过采样，服务器可以将用户的文件系统查询转发给语言模型，获取专业解答，同时通过“人在环路”的设计，确保用户对所有操作保持完全控制，防止潜在的数据安全风险。

## 启动
```bash
uv run server.py
```

重新打开一个终端，启动client:
```bash
uv run client.py ./server.py
```

## 常见问题

### `AttributeError: 'Server' object has no attribute 'list_prompts'`

**根因**：当前依赖装的是 `mcp` **2.x**，但 `server.py` 写的是 v1 的 API。v2 做了两处破坏性变更：

1. **`FastMCP` 被重命名为 `MCPServer`**，`mcp.server.fastmcp` 这个模块在 v2 中已删除（导入会直接抛 `ModuleNotFoundError`，并提示迁移到 `mcp.server.mcpserver.MCPServer`）。
2. **低阶 `Server` 类上的 `@app.list_prompts()` / `@app.get_prompt()` 装饰器被移除**，handler 现在只能通过构造器参数（`on_list_prompts=...` / `on_get_prompt=...`）或 `add_request_handler()` 注册。因此 `app.list_prompts` 这个属性根本不存在，触发 `AttributeError`。

**修复**：迁移到 `MCPServer`（即重命名前的 `FastMCP`），用 `@mcp.prompt()` 装饰器替代原来手动维护 `PROMPTS` 字典 + 两个装饰器 handler 的写法。参数 schema 由框架从函数签名自动推导。

| v1（已废弃） | v2（当前写法） |
|---|---|
| `from mcp.server import Server` | `from mcp.server.mcpserver import MCPServer, Message` |
| `app = Server("name")` | `mcp = MCPServer("name")` |
| 手动 `PROMPTS` 字典 + `@app.list_prompts()` + `@app.get_prompt()` | `@mcp.prompt(name=..., description=...)` |
| handler 接收 `(name, arguments)`，返回 `GetPromptResult` | 函数直接接收 prompt 参数（如 `question: str`），返回 `list[Message]` |
| 手动管理 `stdio_server()` 上下文 | `mcp.run_stdio_async()` |

`client.py` 无需改动 —— 线缆协议（wire protocol）保持不变，`prompt_result.messages[0].content.text` 仍然能拿到 JSON 编码的采样请求。