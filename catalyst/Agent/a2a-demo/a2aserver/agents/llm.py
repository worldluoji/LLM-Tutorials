import os
from openai import OpenAI

client = OpenAI(
    # api_key=os.getenv("AliDeep"),  
    # base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
    api_key=os.getenv("deepseek"),
    base_url="https://api.deepseek.com"
)