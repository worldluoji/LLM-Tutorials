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