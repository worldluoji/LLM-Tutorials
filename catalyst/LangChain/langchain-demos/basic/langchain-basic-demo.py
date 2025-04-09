import os
from langchain_openai.chat_models.base import BaseChatOpenAI
from dotenv import load_dotenv

load_dotenv()

# 初始化LLM
llm = BaseChatOpenAI(
    model='deepseek-chat',  # 使用DeepSeek聊天模型
    openai_api_key=os.environ.get("deepseek"),  # 替换为你的API易API密钥
    openai_api_base='https://api.deepseek.com',  # API易的端点
    max_tokens=1024  # 设置最大生成token数
)

# 简单调用
response = llm.invoke("请你作为一个有远程工作经验的IT专家，介绍一下外国人如何找到一份英语国家的远程IT工作")
print(response.content)