import os
from langchain_openai import ChatOpenAI
from deepagents import create_deep_agent
from deepagents.backends import LocalShellBackend

model = ChatOpenAI(
    model_name="MiniMax-M3",
    base_url="https://api.minimaxi.com/v1",
    api_key=os.getenv("MINIMAX_API_KEY"),
)

backend = LocalShellBackend("./", virtual_mode=True)

agent = create_deep_agent(
    model=model,
    backend=backend,
)

result = agent.invoke({"messages": "当前目录下有哪些文件？"})
print(result)