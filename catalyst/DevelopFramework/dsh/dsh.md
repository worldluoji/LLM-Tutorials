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

---

## 实战
### 1. 快速启动带 Web 界面的 Agent
dsh 的一键启动体验做得非常简洁。假设你已经安装了 Node.js，执行：
```bash
npx @deepseek-ai/dsh web
```
默认会启动 Web UI，地址是 http://127.0.0.1:3080。

第一次进入后，配置好模型，选择好工作区就可以使用了。

### 2. 为 Agent 安装插件
假设我们想装一个社区整理的插件市场 dshmarket，只需要执行：
```bash
dsh plugin --profile web add dshmarket
```
这里有几个概念需要理解：
- profile：位于 $DSH_HOME/profiles/<name></name> 下，描述一份可启动的组合。web 是默认的 profile 模板。
- bundle（组合包）：一个 npm 包，通过 dsh.bundle manifest 声明自己贡献了一个配置层。
- dsh plugin add：会把包安装进 profile，并自动把它追加到 dsh.profile.bundles 列表中。

可以用 --dump-config 查看实际生效的插件树：
```bash
dsh --profile web --dump-config
```

如果想安装 GitHub 上的插件，可以直接用 git 地址：
```bash
dsh plugin --profile web add github:you/awesome-plugin#<sha></sha>
```
需要注意的是，git 安装拉取的是源码，因此包内需要包含 prepare 脚本来自行构建。pnpm ≥10 还会要求你在 profile 的 pnpm-workspace.yaml 里显式授权 allowBuilds，这一点在生产环境中要格外谨慎。

如果想要实现对话式安装插件（类似在爱马仕（Hermes）、龙虾中通过对话安装技能的效果），需要你安装一下 dsh-find-plugin 插件，命令为：
```bash
dsh plugin --profile web add dsh-find-plugin
```

移除插件也很简单，使用下面的命令或者对话式要求移除均可。
```bash
dsh plugin --profile web remove dshmarket
```

### 3. 本地插件开发
-> dsh/scratch-plugin/src/greet-plugin.ts

关键点：
- inject: ['tools'] 声明依赖，框架会等工具注册表就绪再加载本插件。
- defineTool 根据 parameters 推导并校验参数类型。
- execute 返回规范值，output.render 把它转成模型能看到的文本内容。

这份代码的 API 写法与官方内置插件（如 @deepseek-ai/dsh-tool-bash）完全一致，本身没有问题。但有两个坑必须在动手前知道。

第一个坑就是依赖解析位置。插件文件里的 @deepseek-ai/* 导入，是从插件文件所在目录向上查找 node_modules 的。在 deepseek-harness 仓库里开发没问题（仓库根目录就有 node_modules）；但如果你用的是全局安装的 dsh（npx @deepseek-ai/dsh 或全局 npm 安装），把 scratch-plugin 放在任意目录启动会直接报 ERR_MODULE_NOT_FOUND: Cannot find package '@deepseek-ai/dsh-tools'。

解决办法就是把插件目录放进 profile 目录下，让 Node 沿目录向上找到 profile 自己的 node_modules:
```bash
mkdir -p ~/.dsh/profiles/web/scratch-plugin/src
# 把 greet-plugin.ts 放到 ~/.dsh/profiles/web/scratch-plugin/src/ 下
```
另外 ，建议补一个 package.json 声明 "type": "module"。没有它的话，Node 需要把 .ts 文件重新解析为 ES 模块（会报 MODULE_TYPELESS_PACKAGE_JSON 警告并产生性能开销）


然后用 patch 方式本地加载插件，创建 scratch-plugin/cordis.yml,注意 name 必须是绝对路径，然后启动。

仓库开发模式：
```bash
pnpm dsh web --patch ./scratch-plugin/cordis.yml
```

全局安装模式（web 就是 --profile web 的别名，--patch 可重复使用）：
```bash
dsh --profile web --patch /home/you/scratch-plugin/cordis.yml
```

验证：在 Web UI 里输入 Use the greet tool to greet Ada.

Agent 就会调用 greet，并收到 Hello, Ada!。

### 4. 可安装的 bundle
如果想把插件分享给别人，需要把它打包成组合包。目录结构如下：
```
hello-plugin/
├── package.json       # 声明 dsh.bundle
├── cordis.patch.yml   # 配置层
└── index.js           # 插件入口
```

-> dsh/hello-plugin

index.js（注意：bundle 应应该把 greet 工具真正带进来，而不是只打一行日志——原版的 console.log 版 bundle 分享出去后，别人装上根本拿不到 greet 工具）

安装到 profile：
```bash
dsh plugin --profile demo add ./hello-plugin
```

之后就可以用：
```bash
dsh --profile demo
```

来启动一个包含你插件的 Agent。


**三个踩坑点**

第一，本地目录安装是符号链接，bundle 必须自带依赖。dsh plugin add ./hello-plugin 会把目录以 link: 形式装进 profile，并自动把包追加到 dsh.profile.bundles 列表（不需要手改 manifest）。但 Node 解析符号链接时会回到插件的真实路径去解析 @deepseek-ai/* 导入，默认会 ERR_MODULE_NOT_FOUND。

解决办法是让 bundle 自带 node_modules（这也是发布到 npm 时 dependencies 的正确用法）：
```bash
cd hello-plugin
pnpm add @deepseek-ai/dsh-tools@^0.1.0-rc.6
```

第二，demo profile 只有 base 层、没有 Web/headless 应用外壳，dsh --profile demo 会加载插件后退出，适合验证“插件能装上、能加载”，但不适合交互。要在 Web GUI 里真正用上 greet 工具，把 bundle 装进 web profile 并重启 dsh web 即可：
```bash
dsh plugin --profile web add ./hello-plugin
```

第三，npm 上 @deepseek-ai/dsh-headless 的 latest 标签目前指向一个依赖了未发布包的旧版本，直接装会报 404；需要时请显式指定版本，例如 dsh plugin --profile headless add @deepseek-ai/dsh-headless@^0.1.0-rc.6。示例二里的 dshmarket 等社区包不受影响。

### 4. 直接基于 dsh 开发插件
在 AI 时代，我们其实不需要了解这么多细节，也可以开发。比如，可以直接在 dsh 的 web 页面上，发送“帮我开发一个能在飞书中使用 dsh 的插件”，让 dsh 会去阅读 dsh 的源码，学习如何开发插件，然后自动帮你完成开发。

---

## 插件生态速览
虽然 dsh 还是开发者预览阶段，但社区已经围绕它长出了相当丰富的插件生态。awesome-dsh-plugin 仓库整理了数百个插件。