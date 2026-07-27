from smolagents import CodeAgent, OpenAIModel

model = OpenAIModel(
    model_id="MiniMax-M3",
    api_base="https://api.minimax.chat/v1"
)
agent = CodeAgent(tools=[], model=model, stream_outputs=False)

agent.run("计算1+2+3...+100的和")