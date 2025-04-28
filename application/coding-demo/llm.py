import os

from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")
load_dotenv(dotenv_path=".env.local", override=True)

def DeepSeek():
    return ChatOpenAI(
        model= "deepseek-v3",
        api_key= os.environ.get("DASHSCOPE_API_KEY"),
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

def DeepSeek2():
    return ChatOpenAI(
        model= "deepseek-chat",
        api_key= os.environ.get("deepseek"),
        base_url="https://api.deepseek.com",
)