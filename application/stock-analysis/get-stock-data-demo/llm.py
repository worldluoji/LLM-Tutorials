import os

from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")
load_dotenv(dotenv_path=".env.local", override=True)

def DeepSeek():
    return ChatOpenAI(
        model= "deepseek-chat",
        api_key= os.environ.get("deepseek"),
        base_url="https://api.deepseek.com",
)