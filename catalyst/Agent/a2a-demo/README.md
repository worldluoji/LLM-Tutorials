# A2A demo
- common 就是 A2A 的 SDK
- a2aclient 是 client 端的代码
- a2aserver 是服务端的代码，其中包含了 A2A Server 以及 agent。

---

1. 启动 A2A Server
```shell
cd a2aserver
uv run server.py
```
测试是否启动成功
```shell
curl localhost:10008/.well-known/agent.json       
```
正常返回：
```json
{"name":"员工绩效管理系统","description":"查询员工的绩效评分，生成绩效评语","url":"http://localhost:10008/","version":"1.0.0","capabilities":{"streaming":true,"pushNotifications":true,"stateTransitionHistory":false},"defaultInputModes":["text","text/plain"],"defaultOutputModes":["text","text/plain"],"skills":[{"id":"skill1","name":"员工绩效工具","description":"查询员工的绩效评分","tags":["查询员工的绩效评分"],"examples":["张三的绩效是多少分"]},{"id":"skill2","name":"员工绩效评语生成工具","description":"生成绩效评语","tags":["生成绩效评语"],"examples":["请帮我写一段张三的绩效评语"]}]}
```

---

2. 运行 A2A Client
```shell
cd a2aclient
uv run client.py
```

---


所有 Agent 都遵循一个统一的架构模式，主要包括以下几个核心组件：
- agent.py：具体的 Agent 实现逻辑。
- task_manager.py：任务管理器，处理 A2A 协议通信。
- server.py：服务器启动入口。


其中所有 Agent 都实现了以下通用接口：
```python
class AgentBase:
    SUPPORTED_CONTENT_TYPES = ['text', 'text/plain']  # 支持的内容类型
    
    def invoke(self, query: str, session_id: str) -> dict[str, Any]:
        """同步调用接口"""
        pass
    
    async def stream(self, query: str, session_id: str) -> AsyncIterable[dict[str, Any]]:
        """异步流式调用接口"""
        pass
```

所有 Agent 也都返回标准化的响应格式：
```python
{
    'is_task_complete': bool,      # 任务是否完成
    'require_user_input': bool,    # 是否需要用户输入
    'content': str,               # 响应内容
    'parts': list,                # 响应部分（可选）
    'data': dict                  # 结构化数据（可选）
}
```

这就为适配 A2A 协议提供了一个通用接口。通过这个通用接口，以及统一的任务管理机制，把多个异构的、通过完全不同的 Agent 框架开发的智能体，统一起来进行管理，让它们能相互通信，协同完成任务。