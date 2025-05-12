# LLM-TUTORIALS
本仓库整理了大模型相关的知识。
- openai-learning： 包含了OpenAI的介绍、常用API、微调等知识
- drawing： 包含了Stable Diffusion、DALL-E、Midjourney等主流AI绘图平台
- theroy: 主要是注意力机制、transformer等理论知识的整理，帮助理解大模型

---

## 三步走： 
- 第一步，写好提示词、会调用大模型API、理解 agent智能体到底是什么（AI应用开发, 两种类型： 1.  AI first应用 2. 传统应用引入AI）、MCP到底是什么？
- 第二步，模型微调（使大模型具备某项专业能力）
- 第三步，专有模型开发（1. 训练专业领域模型（一是选用一个开源的基模型，二是制作专用领域的高质量数据集，难度较大） 2. 插件开发）

---

## 其它：
- 大模型的一些基础知识，了解原理，比如了解一下注意力机制、transformer、embedding等等；
- 大模型写代码并不可靠，时刻都需要人类程序员监督和测试。GPT生成的代码也不一定是最优的，或者还需要二次处理，这时就需要人工介入编码了。但是大模型已经帮我们解决了至少60%的工作量。
- vscode编码插件：通义灵码、Github Copilot、DeepSeek

## 提示词社区
https://www.aishort.top/

## 提示词技巧
- 角色设定：擅于使用 System 给GPT设定角色和任务，如“哲学大师”；
- 指令注入：在 System 中注入常驻任务指令，如“主题创作“;
- 问题拆解：将复杂问题拆解成的子问题，分步骤执行，如：Debug 和多任务；
- 分层设计：创作长篇内容，分层提问，先概览再章节，最后补充细节，如：小说生成；
- 编程思维：将prompt当做编程语言，主动设计变量、模板和正文，如：评估模型输出质量；
- Few-Shot：基于样例的prompt设计，规范推理路径和输出样式，如：构造几个示例给大模型，让其在解决问题是进行参考；
- 使用[Function Calling](https://github.com/DjangoPeng/openai-quickstart/blob/main/openai_api/function_call.ipynb)进行优化。

伪代码提示词 : https://waytoagi.feishu.cn/wiki/MjUDwTbq9iUtBrkskPXcpfOHnPg?continueFlag=064c935f2a492dc802b4418a918e98d5&s_channel=4&s_trans=6037298494_

优点：
- 能够更精确额的控制大模型的逻辑和输出结果
- 节省token

缺点：
- 需要懂代码，有门槛
- 直观性受损

---

## GPT类的应用搭建：
ChatGPT-Next-Web可以用于自己搭建一套GPT类的应用（Light and Fast AI Assistant,with Claude, DeepSeek, GPT4 & Gemini Pro support.）

https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web

---

## 前端开发的AI代表：
- v0 AI:   https://v0.dev/  
- Open ui:  https://github.com/wandb/openui

---

## 经验
- 如果传统开发是用代码逻辑复制人类已有的逻辑，那大模型开发就是用数据让 AI 自主学习到这个逻辑；
- 简单地套壳大模型很容易被大模型的更新替代，而要做大模型底层技术则需要大量的资金和人才密度。如果你的团队已经有成熟的业务模式，则应该考虑利用大模型改造现有业务，做应用创新，而不是大模型底层创新；如果你是个人开发者，建议是先从大模型微调开始，深入理解大模型技术，未来寻找领域场景；
- AI 的真正价值点在于基于效率提升；
- 核心是客户的付费习惯问题。用户只会为结果付费，而且必须有效率 / 数据的提升。这也是大模型厂商全部降价亏本推广的原因，比如讯飞大模型，去年一个注册用户还只是送 200 万 token，现在已经送 1 亿个 token 了；
- 做 AI 应用，就是要把大模型当人对待，大模型就是我们的下属，我们的员工。