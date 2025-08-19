该工程用于演示 MCP的 client端。使用stdio模式。

工程使用如下命令创建而来：
```shell
uv init mcp-client-demo

uv add "mcp[cli]"

pipx install mcp
```

运行：
```shell
uv run client.py
```