from smolagents import CodeAgent, MCPClient, OpenAIModel

model = OpenAIModel(
    model_id="MiniMax-M3",
    api_base="https://api.minimax.chat/v1"
)

with MCPClient({"url": "http://127.0.0.1:38000/mcp", "transport": "streamable-http"}) as tools:
    agent = CodeAgent(tools=tools, model=model, stream_outputs=False)
    agent.run("针对/Users/luoji1/code/LLM-Tutorials/catalyst/DevelopFramework/Smolagents/demo/data/yanjing_beer_daily_k_20250518_20260518.csv中的数据展开走势分析，并输出一份markdown格式的分析报告，写入到当前目录的report.md文件中")