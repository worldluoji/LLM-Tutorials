import os
from langchain_openai import ChatOpenAI
from deepagents import create_deep_agent
from deepagents.backends import LocalShellBackend
from dotenv import load_dotenv

load_dotenv()

model = ChatOpenAI(
    model_name="MiniMax-M3",
    base_url="https://api.minimaxi.com/v1",
    api_key=os.getenv("MINIMAX_API_KEY"),
)

backend = LocalShellBackend("./", virtual_mode=True)

agent = create_deep_agent(
    model=model,
    backend=backend,
    system_prompt="你是一个投研知识库管理助手，擅长利用 stock-wiki 技能来进行本地知识库的构建、资料导入、查询、维护等工作",
    skills=["/Users/luoji1/code/LLM-Tutorials/catalyst/DevelopFramework/Deepagents/.claude/skills", 
            "/Users/luoji1/code/LLM-Tutorials/catalyst/DevelopFramework/ClaudeAgentSDK/demo/.claude/skills"],
)

run_config = {"recursion_limit": 50}

result = agent.invoke({"messages": "生成科大讯飞 SZ002230 的2025年金融研报"}, run_config=run_config)

print(result)