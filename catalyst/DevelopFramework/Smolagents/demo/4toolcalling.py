from smolagents import ToolCallingAgent, OpenAIModel

model = OpenAIModel(
    model_id="MiniMax-M3",
    api_base="https://api.minimax.chat/v1",
    extra_body={"enable_thinking":False}
)

agent = ToolCallingAgent(tools=[], model=model)

agent.run("计算1+2+3...+100的和")