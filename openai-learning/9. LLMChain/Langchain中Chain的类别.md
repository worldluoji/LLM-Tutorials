# Langchain中Chain的类别
## LLMChain
用于与 LLM 直接交互，适合文本生成、问答等任务。

## LLMRequestsChain
结合外部 API 和 LLM，适合需要动态获取外部数据的任务。

[示例](./tools/llmchain-requests.py)

## VectorDBQA
结合向量数据库和 LLM，适合从大量文档中检索信息并生成答案。

[示例](./tools/llmchain-VectorDBQA.py)


## SimpleSequentialChain 和 SequentialChain的区别

### 1. **SimpleSequentialChain（简单顺序链）**
   - **比喻**：流水线
   - **特点**：
     - 任务是一个接一个执行的，前一个任务的输出会作为下一个任务的输入。
     - 数据只能单向流动，不能保存中间状态。
     - 适合简单的、线性的任务流程。
   - **例子**：假设你有三个任务 A、B、C，A 的输出传给 B，B 的输出传给 C，整个过程是线性的。

### 2. **SequentialChain（顺序链）**
   - **比喻**：工作站
   - **特点**：
     - 可以同时处理多个任务，并且可以保存中间状态。
     - 任务之间可以有更复杂的依赖关系，不一定是一个接一个的线性流程。
     - 适合需要保存中间结果或并行处理的任务。
   - **例子**：假设你有三个任务 A、B、C，A 的输出可以同时传给 B 和 C，或者 B 和 C 可以并行执行，最后再合并结果。

### 区别：
- **SimpleSequentialChain** 就像一条流水线，产品只能一个接一个往下传，适合简单的线性任务。
- **SequentialChain** 更像一个工作站，可以同时处理多个部件，并且保存中间状态，适合复杂的任务流程。


## LLMMathChain
用于数学计算的链，使用LLM进行数学计算，并返回结果。

[示例](./tools/llmchain-exec-python.py)


## ConversationChain
ConversationChain 是 LangChain 中用于多轮对话的核心工具。

它通过记忆机制保存对话历史，支持上下文感知的交互。

适合构建聊天机器人、客服系统等需要记忆和上下文感知的应用。

记忆机制：
- ConversationBufferMemory：保存完整的对话历史。
- ConversationSummaryMemory：对对话历史进行摘要，适合长对话。
- ConversationEntityMemory：记住对话中的实体（如人名、地点等）。

[示例](./memory/llmchain-SummaryBufferMemory.py)
