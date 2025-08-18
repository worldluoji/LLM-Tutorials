# MCP 提示模板的实现 DEMO
## server
在  get_prompt  函数里会通过读取  arguments  参数，动态拼接和生成返回的提示内容。这样你可以根据传入的参数，灵活调整返回给 Client 端的提示内容。而 jsonRPC 消息的构建细节和格式，就不用你我来操心了。

---

## 运行
```
uv run client.py ./server.py 
```
此时客户端和服务器讲同时启动并通过 stdio 相连接