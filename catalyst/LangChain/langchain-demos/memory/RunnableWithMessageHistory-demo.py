import os

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai.chat_models.base import BaseChatOpenAI
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory

from dotenv import load_dotenv

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
 
'''
这里使用InMemoryChatMessageHistory存在内存中，实际可以持久化到redis等：

from langchain_community.chat_message_histories import RedisChatMessageHistory

def get_persistent_history(session_id):
    return RedisChatMessageHistory(session_id, url="redis://localhost:6379")
'''
def get_session_history(session_id):
    if session_id not in store:
        # 为每个会话（session_id）创建独立的内存存储，保存对话历史。
        store[session_id] = InMemoryChatMessageHistory()
    return store[session_id]

'''
​工作机制：

当调用.invoke()时，根据session_id从store中加载历史。
1.将当前输入消息（如HumanMessage）​追加到历史记录。
2.将完整历史（包括过去的所有消息）作为上下文传给LLM。
3.将LLM的响应（AIMessage）​追加到历史记录。
'''
with_message_history = RunnableWithMessageHistory(llm, get_session_history)
 
config = {"configurable": {"session_id": "test_session_123456"}}
 
response = with_message_history.invoke(
    [HumanMessage(content="Hi! I'm Bob")],
    config=config,
)
 
print(response.content)
 
response = with_message_history.invoke(
    [HumanMessage(content="What's my name?")],
    config=config,
)
 
print(response.content)