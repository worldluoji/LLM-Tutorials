import os
from dotenv import load_dotenv
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai.chat_models.base import BaseChatOpenAI

load_dotenv()

# 初始化LLM
llm = BaseChatOpenAI(
    model='deepseek-chat',  # 使用DeepSeek聊天模型
    openai_api_key=os.environ.get("deepseek"),  # 替换为你的API易API密钥
    openai_api_base='https://api.deepseek.com',  # API易的端点
    max_tokens=1024  # 设置最大生成token数
)

# 用字典存储聊天历史
store = {}
def get_session_history(session_id):
    if session_id not in store:
        # 为每个会话（session_id）创建独立的内存存储，保存对话历史。
        store[session_id] = InMemoryChatMessageHistory()
    return store[session_id]

with_message_history = RunnableWithMessageHistory(llm, get_session_history)
 
config = {"configurable": {"session_id": "test_session_123456"}}

def get_session_history(session_id):
    if session_id not in store:
        # 为每个会话（session_id）创建独立的内存存储，保存对话历史。
        store[session_id] = InMemoryChatMessageHistory()
    return store[session_id]


user_input = "我叫张老三，订单号2023ABCD，邮箱customer@abc.com"

response = with_message_history.invoke(
    [HumanMessage(content=user_input)],
    config=config,
)
 
print(response.content)
 
response = with_message_history.invoke(
    [HumanMessage(content="请帮我查看订单状态")],
    config=config,
)
 
print(response.content)

print(store["test_session_123456"])