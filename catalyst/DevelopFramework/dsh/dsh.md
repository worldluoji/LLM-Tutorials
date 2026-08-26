# dsh
DeepSeek Harness 是 DeepSeek AI 在近期发布的开源 Agent Harness。它既是一个可以直接运行的 Coding Agent 产品（提供 Web UI 和 headless 两种形态），又是一套可组装的底层框架。

如果说前面几个框架的扩展方式主要是“在 SDK 里写代码”，那么 dsh 的核心理念则是 “一切皆插件”：不仅工具、模型适配器、UI 是插件，就连 Agent Loop 本身和会话日志机制都是插件，整个运行时由 Cordis 插件框架驱动。

你既可以用一行命令启动它：
```bash
npx @deepseek-ai/dsh web
```
打开浏览器就是一个完整的 Codex 风格的 Coding Agent 界面；也可以把它当作底座，通过插件替换模型适配器、工具实现、沙箱后端、UI 渲染，甚至替换 Agent Loop 的默认驱动，组装出完全不一样的 Agent 产品。

dsh 的底层基于 Cordis 插件框架。Cordis 的核心思想是：运行中的 dsh 是一棵插件树，每个插件向共享上下文贡献服务、类型化事件和可逆的副作用。插件之间通过 `ctx.<key></key>` 查找服务，通过 `inject` 声明依赖，通过事件进行通信，而不是直接 import 彼此的具体实现。

这意味着，dsh 里不存在一个需要打补丁的特权内核。你想扩展它，不是去改框架源码，而是把新插件挂载到现有插件旁边；插件卸载时，它注册的所有工具、事件监听、提示词片段都会自动撤销。

---

## DeepSeek Harness 的四个核心特点
### 1. 一切皆插件
在 dsh 中，产品的每一部分都是插件。
- 模型适配器（ctx.llm）是插件
- 工具注册表和执行流水线（ctx.tools）是插件
- 会话日志和持久化（ctx.sessions）是插件
- 系统提示词组装（ctx.systemPrompt）是插件
- Agent Loop 本身（ctx.agentLoop）也是插件

这种设计的直接好处是：你可以从配置层替换任何一部分，而不需要 fork 整个框架。例如，把本地沙箱换成 E2B 远程沙箱，只需要换一个 ctx.sandbox 的 provider，Bash、PTY、LSP 等 Consumer 会自动跟着迁移过去。

### 2. Cordis：服务、注入、事件、可逆副作用
Cordis 的五个核心概念构成了 dsh 的骨架：
- 插件是实现 Service 的对象：可以是一个带 apply(ctx) 的函数，也可以是一个 Service 子类。
- 上下文是服务的容器：每个服务占据稳定的 `ctx.<key></key>`，如 ctx.tools、ctx.llm。
- 通过 inject 声明依赖：插件声明所需服务后，框架会等依赖就绪才加载它。
- 类型化事件用于通信：事件有 emit、waterfall、parallel、serial 等分发模式。
- 注册是可逆的副作用：工具、监听器、提示词片段都通过 ctx.effect() 或 ctx.on() 安装，插件卸载时自动清理。

这套机制让 dsh 在扩展性上非常像“Agent 界的 VS Code”——核心很小，能力全靠插件叠加。

### 3. 能力 seam：可替换的能力边界
dsh 把可替换能力抽象为 seam，每个 seam 包含三种角色：
- Service Definition：声明接口
- Service Provider：实现接口
- Consumer：面向模型或 UI 使用接口

比如 shell 能力就有独立的 Definition、本地 provider、Consumer 工具。你替换 provider，Consumer 不需要改代码。这种分层比 Pi-mono 的 pi-ai / pi-agent-core / pi-coding-agent 更细，更接近微内核操作系统的设计。

### 4. 会话日志是模型上下文的唯一来源
dsh 有一个很强的运行时不变量：模型可见即已记录。任何到达模型请求的内容，都必须能从会话日志重建。fork、恢复、transcript、遥测、持久化都派生自同一个事件流。

这和 Claude Agent SDK 的五级上下文压缩、Pi-mono 的 AgentSession 持久化异曲同工，但 dsh 把它上升到了架构的第一性原则：日志不是副产物，而是运行时的核心数据源。