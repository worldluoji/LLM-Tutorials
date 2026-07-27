from smolagents import CodeAgent, OpenAIModel
# CodeAgent 就是基于 CodeAct 模式的 Agent，OpenAIModel 则是用于 Smolagents 连接 OpenAI 兼容模型的客户端。

model = OpenAIModel(
    model_id="MiniMax-M3",
    api_base="https://api.minimax.chat/v1"
)
agent = CodeAgent(tools=[], model=model, stream_outputs=False)

agent.run("计算1+2+3...+100的和")