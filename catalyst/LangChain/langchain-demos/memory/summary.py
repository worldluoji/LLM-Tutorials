import os

from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
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

# 构建对话链
prompt = ChatPromptTemplate.from_messages([
    SystemMessage(content="你是一位专业远程IT自由职业者，用简洁中文回答，每次回答不超过100字。"),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}")
])

store = {}

# 自定义带总结的历史记录类
class ChatHistorySummary(BaseChatMessageHistory):
    def __init__(self):
        self._messages = []
        self._summary = ""
    @property
    def messages(self):
        return [self._summary]

    # 每次请求大模型完成之后，才执行add_messages
    def add_messages(self, messages):
        """添加多条消息"""
        self._messages.extend(messages)
        self._generate_summary()
        self._messages.clear() # 因为历史摘要保存在了summary，清空即可

    def _generate_summary(self):
        """调用大模型生成智能摘要"""
        summary_prompt = """请用中文简洁总结以下对话的核心内容，保留关键细节。避免丢失具体数据：
        
        {dialog}
        
        摘要："""
        
        # 提取最近对话生成摘要
        dialog = '\r\n'.join([
            f"{'用户' if isinstance(m, HumanMessage) else '助理'}: {m.content}"
            for m in self._messages
        ])

        if self._summary:
            dialog = self._summary + '\r\n' + dialog

        summary_chain = ChatPromptTemplate.from_template(summary_prompt) | llm
        new_summary = summary_chain.invoke({"dialog": dialog}).content
        self._summary = new_summary
    def clear(self) -> None:
        self._messages.clear()

def get_session_history(session_id: str) -> BaseChatMessageHistory:
    if session_id not in store:
        store[session_id] = ChatHistorySummary()
    return store[session_id]


chain = prompt | llm

# 正确初始化带历史的链
with_message_history = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history" # 表示将自动从历史记录中提取消息，并注入到 prompt 的同名占位符
)

# 使用示例
config = {"configurable": {"session_id": "test"}}

msgs = ["你是谁？", "找一份远程IT工作需要具备哪些技能", "英语有要求吗", "口语如何训练", "我问你的第1句话是什么？"]
# 模拟4轮对话（保留最后3轮）
for i in range(0, len(msgs)):
    response = with_message_history.invoke(
         {"input": msgs[i]},
        config=config
    )
    print(response.content)
    print(f"Round {i} History summary:", store["test"].messages)

# summary也会丢失信息，而且无法记忆“第1句是什么”类似的问题