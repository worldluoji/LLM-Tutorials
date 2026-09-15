# Visual ChatGPT
Visual ChatGPT是微软在2023年推出的多模态AI系统，整合ChatGPT与VFM，弥补了纯文本交互在视觉处理上的局限，实现视觉与语言的深度融合，
<strong>能理解、生成图像并执行编辑操作</strong>，增强用户体验及拓展至图像生成、编辑、VQA等多元应用场景，并开放源码以促进开发者创新。

微软通过 HuggingFace 的 Space 功能提供了一个免费的 Space，让你可以直接体验 Visual ChatGPT 的功能。
不过，考虑到用的人很多，使用的过程中你的请求会被排队处理，往往要等待很长时间才能完成一条指令。
所以，建议你花个几美元的小钱，部署一个自己的 Visual ChatGPT 的 Space 来体验一下它的功能。


## Visual ChatGPT 的原理与实现
Visual ChatGPT 解决问题的办法就是使用 LangChain 的 ReAct Agent 模式，它做了这样几件事情。
- 它把各种各样图像处理的视觉基础模型（Visual Foundation Model）都封装成了一个个 Tool。
- 然后，将这些 Tool 都交给了一个 conversation-react-description 类型的 Agent。每次你输入文本的时候，其实就是和这个 Agent 在交流。
Agent 接收到你的文本，就要判断自己应该使用哪一个 Tool，还有应该从输入的内容里提取什么参数给到这个 Tool。这些输入参数中既包括需要修改哪一个图片，也包括使用什么样的提示语。
这里的 Agent 背后使用的就是 ChatGPT。
- 最后，Agent 会实际去调用这个 Tool，生成一张新的图片返回给你。


Visual ChatGPT 的源代码只有一个文件 [visual_chatgpt.py](https://github.com/chenfei-wu/TaskMatrix/blob/main/visual_chatgpt.py)
> 注：原 `chenfei-wu/TaskMatrix` 仓库已于 2024 年 archive。如需学习 Vision Tool 集成思路，可改读 [LangChain OpenAI Tools Agent 源码](https://github.com/langchain-ai/langchain) 或 `transformers` + `gradio` 的现代替代实现。

整个文件从头到尾可以分成四个部分。
- 一系列预先定义好的 ChatGPT 的 Prompt，以及一些会被调用的辅助函数。
- 一系列视觉模型的 Class，每一个 Class 都代表了一个或者多个图片处理的工具。
- 一个叫做 ConversationBot 的 Class，实际封装了通过对话调用各种视觉模型工具的流程。
- 实际从命令行启动整个应用的入口，其实就是对 ConverationBot 提供了一个 Gradio 应用的封装。