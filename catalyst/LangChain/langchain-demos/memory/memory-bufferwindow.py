import os

from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import AIMessage, HumanMessage
from langchain_openai.chat_models.base import BaseChatOpenAI
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from dotenv import load_dotenv

load_dotenv()

# 初始化LLM
llm = BaseChatOpenAI(
    model='deepseek-chat',  # 使用DeepSeek聊天模型
    openai_api_key=os.environ.get("deepseek"),  # 替换为你的API易API密钥
    openai_api_base='https://api.deepseek.com',  # API易的端点
    max_tokens=1024  # 设置最大生成token数
)

store = {}

# 自定义带窗口限制的历史记录类
class WindowedChatHistory(BaseChatMessageHistory):
    def __init__(self, max_messages=6):  # 3轮对话（每轮包含用户和AI消息）
        self._messages = []
        self.max_messages = max_messages  # 最大消息数 = 轮数*2
    
    @property
    def messages(self):
        """获取已截断的历史记录"""
        return self._truncate()

    def add_message(self, message):
        self._messages.append(message)
    
    def add_messages(self, messages):
        """添加多条消息"""
        self._messages.extend(messages)
    
    def _truncate(self):
        total_messages = len(self._messages)
        keep_messages = min(total_messages, self.max_messages)
        return self._messages[-keep_messages:]
    def clear(self) -> None:
        """清空历史记录（必须实现的抽象方法）"""
        self._messages.clear()

def get_session_history(session_id: str) -> BaseChatMessageHistory:
    if session_id not in store:
        store[session_id] = WindowedChatHistory(max_messages=6)  # 保留3轮对话
    return store[session_id]


# 正确初始化带历史的链
with_message_history = RunnableWithMessageHistory(
    llm,
    get_session_history
)

# 使用示例
config = {"configurable": {"session_id": "test"}}

msgs = ["你是谁？", "鱼香肉丝怎么做？", "那宫保鸡丁呢", "你是一名优秀的厨师呢", "我问你的第1句话是什么？"]
# 模拟4轮对话（保留最后3轮）
for i in range(0, len(msgs)):
    response = with_message_history.invoke(
        [HumanMessage(content=msgs[i])],
        config=config
    )
    print(response.content)
    print(f"Round {i} History Length:", len(store["test"].messages))