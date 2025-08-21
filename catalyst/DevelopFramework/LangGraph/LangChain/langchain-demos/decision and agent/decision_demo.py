
import os

from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough, RunnableParallel
from langchain_openai.chat_models.base import BaseChatOpenAI

from dotenv import load_dotenv

load_dotenv()

llm = BaseChatOpenAI(
    model='deepseek-chat',  # 使用DeepSeek聊天模型
    openai_api_key=os.environ.get("deepseek"),  # 替换为你的API易API密钥
    openai_api_base='https://api.deepseek.com',  # API易的端点
    max_tokens=1024  # 设置最大生成token数
)
multiple_choice = """
请针对 >>> 和 <<< 中间的用户问题，选择一个合适的工具去回答她的问题。只要用A、B、C的选项字母告诉我答案。
如果你觉得都不合适，就选D。

>>>{question}<<<

我们有的工具包括：
A. 一个能够查询商品信息，为用户进行商品导购的工具
B. 一个能够查询订单信息，获得最新的订单情况的工具
C. 一个能够搜索商家的退换货政策、运费、物流时长、支付渠道、覆盖国家的工具
D. 都不合适
"""
multiple_choice_prompt = PromptTemplate(template=multiple_choice, input_variables=["question"])

choice_chain = (
    RunnableParallel({"question": RunnablePassthrough()})
    | multiple_choice_prompt
    | llm
    | (lambda x: {"answer": x.content})
)


question = "请问你们的货，能送到三亚吗？大概需要几天？"
print(choice_chain.invoke(question))

question = "我想买一件衣服，但是不知道哪个款式好看，你能帮我推荐一下吗？"
print(choice_chain.invoke(question))