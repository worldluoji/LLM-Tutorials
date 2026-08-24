# pimono
Claude Agent SDK 的 Harness 工程非常成熟，上下文管理、Skills、Hooks 都提供了开箱即用的体验。但它有一个始终绕不开的痛点——闭源。

这意味着你无法看到其内部实现细节，无法根据业务需求深度定制，甚至在遇到国产模型兼容性问题时只能被动等待官方修复——就像我们不得不退回到 0.1.62 版本那样。因此，我们介绍了 Deepagents 这个脚手架，它可以部分平替 Claude Agent SDK。

除了 Deepagents，如果我们走出 Python 技术栈，TypeScript 脚手架 Pi-mono 也是非常好的选择，它是随着龙虾（OpenClaw）一起火起来的。对于 TypeScript 技术栈的 AI 开发者，选择 Pi-mono 有天然的优势：源码就在你眼前，每一层设计都清晰可扩展。

---

## 为什么选 Pi-mono
Pi-mono 最吸引人的地方在于它的工程分层。不像一些把所有功能揉在一起的框架，Pi-mono 把 Agent 能力拆成了几个职责清晰的包。你既可以直接使用高层的 pi-coding-agent 快速获得一个开箱即用的 Harness Agent，也可以下沉到 pi-agent-core 甚至 pi-ai 来做自由定制。

这种分层带来两个直接好处：
- 第一，可审计。闭源框架出了问题你只能猜，而 Pi-mono 的源码就在本地，你可以一行行跟进去看 Agent Loop 是怎么调 LLM 的、工具是怎么执行的、事件是怎么流转的。
- 第二，可替换。如果你发现默认的上下文压缩策略不适合你的业务场景，可以直接替换。

Pi-mono 的核心包按照从底到上的顺序可以分成四层。

第一层是 pi-ai，也就是统一 AI 层。它负责屏蔽不同 LLM Provider 的差异。无论是 Anthropic、OpenAI、Google 还是 Bedrock，在 Pi-mono 里都使用同一套 Model、Context、Message 抽象。你只需要提供模型配置和 API key，剩下的流式输出、工具调用格式、参数校验都由这一层处理。这一层让我们可以轻松切换模型。比如日常审查用成本较低的模型做初筛，遇到复杂条款时再切换到更强的模型做深度分析，而业务代码几乎不用改。这点可以说是 Pi-mono 中做得让人最舒服的一点，其他框架比如 Deepagents 等，都做不到这种跨协议的统一性。

第二层是 pi-agent-core，这是真正的 Agent 运行时。它提供了 Agent 类和 AgentLoop，管理状态、订阅事件、执行工具、处理 steering 和 followUp。这一层的核心是事件驱动模型：Agent 的每一次状态变化都会以事件的形式发出，UI 层和扩展层通过订阅这些事件来更新界面或拦截行为。

第三层是 pi-coding-agent，这是面向应用开发者的 SDK 层。它在 Agent 之上封装了 AgentSession，帮你处理会话持久化、上下文压缩、自动重试、扩展加载、内置工具集等工程细节。对大多数业务场景来说，直接基于这一层开发就够了。

第四层是 pi-tui，终端 UI 渲染引擎。它用差分渲染技术让终端界面像浏览器一样流畅，支持自定义组件、对话框、选择器等。

**模型调用问题看 pi-ai，循环逻辑问题看 pi-agent-core，业务封装问题看 pi-coding-agent，界面问题看 pi-tui。**

---

## 理解 AgentSession 与 Agent 的关系
两个容易混淆的概念：AgentSession 和 Agent。

Agent 来自 @earendil-works/pi-agent-core，是底层的 Agent 运行时。它只关心一个问题：给定一个 system prompt、一组 messages、一组 tools，如何与 LLM 循环交互。

AgentSession 来自 @earendil-works/pi-coding-agent，是高层封装。它在 Agent 之上增加了：
- 会话持久化（把 messages 写入本地 session 文件）
- 上下文压缩（compact()）
- 自动重试
- 扩展系统绑定
- 默认工具集管理
- steering / followUp 队列

**在业务代码中，我们通常直接操作 AgentSession，只有在需要深度定制循环行为时才会接触 Agent。**

可以通过 session.agent 访问底层 Agent：
```ts
console.log(session.agent.state.tools.map((t) => t.name));
console.log(session.agent.state.messages.length);
```

---

## 实战
### 项目背景
合同审查是企业法务、采购、商务团队最高频的工作之一。一份普通的商业合同可能包含数十页文本，涉及甲乙方权利义务、违约责任、知识产权归属、争议解决等多个关键模块。传统的人工审查方式不仅耗时，而且高度依赖审查者的经验。新手法务可能漏掉隐藏条款，哪怕是资深法务也会被海量合同淹没。

更麻烦的是，合同审查并非简单的“找关键词”。同样一句话“甲方有权根据市场情况调整价格”，在采购合同里可能是正常的调价机制，在技术外包合同里却可能是不平等条款。判断风险需要结合合同类型、我方角色、行业惯例、具体语境等多重因素。

而这些挑战恰好是 Agent 擅长的领域——长文本处理。Agent 可以快速通读全文，不遗漏条款。

### 环境搭建
```
mkdir contract-review-agent
cd contract-review-agent
npm init -y

pnpm add @earendil-works/pi-coding-agent
pnpm add -D typescript @types/node
```
注意：
- package.json — 删掉误装的 "all": "link:@earendil-works/pi-ai/providers/all"(那是 npm i             @earendil-works/pi-ai/providers/all 被当成本地路径的产物,链接是断的),改为正常安装                          @earendil-works/pi-ai@0.84.2;并加上 "type": "module"(pi-ai 是纯 ESM 包)；                                     
- 新建 tsconfig.json — 关键是 moduleResolution: "nodenext"。之前没有 tsconfig,TS 默认 node10 解析,不认 package.json 的 exports 字段,所以即使装了包 providers/all 子路径也找不到。


支持的模型和环境变量如何设置可以在[这里](https://github.com/earendil-works/pi/tree/main/packages/ai#supported-providers)查看。

万一有一些冷门模型，不在 Pi 的支持列表中？其实只要它支持 OpenAI 兼容接口，同样可以用。Pi-mono 的 pi-ai 层会自动处理协议差异。只不过代码会麻烦一点，比如如果正常支持的模型，在代码中可以这样写：
```ts
const { session } = await createAgentSession({
    model: getModel("openai", "gpt-4o"),
    thinkingLevel: "medium",
    cwd: process.cwd(),
});
```
新版的需 getModel 方法需要从 builtinModels获取：
```ts
const models = builtinModels();
models.getModel("MiniMax", "MiniMax-M3"),
```

但如果是不在模型支持列表中的，但又能兼容 OpenAI 的，那在环境变量 OPENAI_API_KEY 填入你所使用的模型的 API Key 的前提下，可以通过以下代码进行实现。以 MiniMax 为例，不过这里仅仅是演示，因为 MiniMax 本身也是 Pi 支持的模型供应商。代码如下：
```ts
const minimaxiModel = {
  id: "MiniMax-M3",
  name: "MiniMax M3",
  api: "openai-responses",
  provider: "openai",
  baseUrl: "https://api.minimaxi.com/v1",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 8192,
} satisfies Model<"openai-responses">;


const { session, modelFallbackMessage } = await createAgentSession({
    cwd: process.cwd(),
    model: minimaxiModel,
    thinkingLevel: "medium",
  });
```
以上代码通过构建一个支持 OpenAI 的 responses API 的 model 结构来定义模型参数。

下面给出支持 completions API 的代码：
```ts
const minimaxiModel = {
  id: "MiniMax-M3",
  name: "MiniMax M3",
  api: "openai-completions",
  provider: "openai",
  baseUrl: "https://api.minimaxi.com/v1",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 8192,
} satisfies Model<"openai-completions">;
```

### 最小的 Runtime
环境和模型就绪后，我们写一个最小的 Runtime。在 src/runtime/minimal.ts 中.

这段代码虽然短，但已经覆盖了一个生产级 Runtime 的核心要素：
- createAgentSession()：自动完成模型解析、API key 获取、默认工具加载、扩展发现、会话初始化。
- session.subscribe()：订阅事件流。这里我们只处理了 message_update 和工具执行事件，后续可以根据需要增加更多处理。
- session.prompt()：发送用户消息，触发一个完整的 Agent Run。


运行:
```bash
npx tsx src/runtime/minimal.ts
```