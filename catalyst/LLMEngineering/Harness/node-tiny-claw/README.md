# node-tiny-claw
用 Node.js 实现的一个简易版的 openclaw， 熟悉 harness 工程基本原理。

## 架构分层解析
- 入口交互层：引擎对外的触角。我们将支持终端命令行（CLI）输入，并将其接入飞书。更重要的是，这一层包含了人工审批（Human-in-the-loop）的异步回调机制。
- 核心引擎层（心脏）：系统的控制中枢。Main Loop 负责维持 ReAct 循环。旁边的大模型适配器是“大脑接口”，抹平不同大模型（如 Claude 和 OpenAI 兼容）底层 API 的差异。新增的 Thinking 模块则负责在行动前强制模型进行慢思考。
- 上下文工程层（内存管理器）：决定 Agent 能够跑多远的关键。
  - a. Prompt 动态组装器：动态拼装模块化的系统规则（如读取 AGENTS.md）。
  - b. Token 监控与阶梯压缩器：像 OS 的内存回收器一样，时刻盯着 Token 水位线触发压缩。
  - c. 运行时事件提醒注入：是防走神的利器，在模型做决定的前一刻注入干预指令。
- 基于文件系统的状态与记忆则是极简哲学的核心——抛弃内部变量，直接把进度写在本地 TODO.md 里。
- 工具与执行层（四肢与手脚）：挂载了让模型改变物理世界的组件。动态的 ToolRegistry 配合极简工具集（read/write/edit/bash），让模型组合出无限可能。强大的 Middleware 机制则死死把守大门，拦截危险命令并对接审批。

---

## script
检查 MiniMax 是否可以用：
```bash
MINIMAX_API_KEY=$MINIMAX_API_KEY pnpm test:minimax
```