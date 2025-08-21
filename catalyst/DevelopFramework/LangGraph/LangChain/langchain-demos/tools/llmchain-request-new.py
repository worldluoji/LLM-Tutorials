import os
import requests
from bs4 import BeautifulSoup
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_openai.chat_models.base import BaseChatOpenAI
from dotenv import load_dotenv

load_dotenv()

# 修正temperature拼写错误
llm = BaseChatOpenAI(
    model='deepseek-chat',
    openai_api_key=os.environ.get("deepseek"),
    openai_api_base='https://api.deepseek.com',
    max_tokens=1024,
    temperature=0  # 参数名更正
)

template = """在 >>> 和 <<< 直接是来自Google的原始搜索结果.
提取问题答案：'{query}'
格式要求：
Extracted:<回答或"找不到">
>>> {requests_result} <<<
Extracted:"""

PROMPT = PromptTemplate(
    input_variables=["query", "requests_result"],
    template=template,
)

def fetch_weather_data(url: str) -> str:
    """使用requests获取并解析Google搜索结果"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    try:
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 定位天气信息容器（根据实际页面结构调整选择器）
        weather_container = soup.find('div', class_='BNeawe s3v9rd AP7Wnd')
        return weather_container.get_text() if weather_container else "找不到"
    except Exception as e:
        print(f"请求失败: {str(e)}")
        return "找不到"

# 构建处理链
processing_chain = (
    RunnablePassthrough.assign(
        url=lambda x: f"https://www.google.com/search?q={x['query'].replace(' ', '+')}"
    )
    | RunnableLambda(lambda x: {
        "query": x["query"],
        "requests_result": fetch_weather_data(x["url"])
    })
    | PROMPT
    | llm
)

# 执行天气查询
weather_data = processing_chain.invoke({"query": "今天成都的天气怎么样？"})
print(f"原始结果: {weather_data.content}\n")

# 结构化解析函数（保持原逻辑）
def parse_weather_info(weather_info: str) -> dict:
    """解析天气字符串为结构化数据"""
    parts = weather_info.split('; ')
    
    return {
        'weather': parts[0].strip(),
        'temperature_min': int(parts[1].replace('℃', '').split('～')[0]),
        'temperature_max': int(parts[1].replace('℃', '').split('～')[1]),
        'wind_direction': parts[2].split(' ')[0].strip(),
        'wind_force': parts[2].split(' ')[1].strip()
    } if len(parts) == 3 else {"error": "格式异常"}

# 测试解析功能
sample_data = "小雨; 10℃～15℃; 东北风 风力4-5级"
parsed_data = parse_weather_info(sample_data)
print(f"结构化结果: {parsed_data}")