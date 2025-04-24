# LangGraph
## LangGraph出现的背景
LangChain 核心就是提供了 Chain（链）的功能。需要注意的是这条链在方向上来说是单向的，不能够向回流或者循环。

随着 AI 逐渐深入到业务，在落地一些应用的时候，大家就发现使用这种单向的链，有些应用搞不定，比如AgenticRAG，也有人叫 GraphRAG。因为这样的应用不仅要有分支的功能，还要具备循环的功能。这时就需要用图结构来表示业务了。

![AgenticRAG](../Vector%20Store/assets/RAG示意图.png)

在此背景下，LangChain 项目组开发了一个扩展库，取名叫 LangGraph。这个库功能很强大，因为能够实现图的方式，解决 AgenticRAG 那是小菜一碟。而且最近调用 LangChain 较新版本 Agent 功能的开发者可能会看到一条这样的警告：
```
LangChainDeprecationWarning: LangChain agents will continue to be supported, but is is recommended for new use cases to be built with LangGraph.
```
就是说 LangChain 就快不更新 Agent 的功能了，如果想体验后续的 Agent 新功能，请去使用 LangGraph。

---

## LangGraph示例