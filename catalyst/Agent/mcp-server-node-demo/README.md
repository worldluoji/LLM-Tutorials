# MCP node demo
在 RooCode或者 Claude code等 MCP Hosts中添加如下配置:
```
{
  "mcpServers": {
    "node-demo-server": {
      "command": "node",
      "args": ["/path/to/your/server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```