
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

q1_prompt = PromptTemplate(
    input_variables=["year1"],
    template="{year1}年的欧冠联赛的冠军是哪支球队，只说球队名称。"
)
q2_prompt = PromptTemplate(
    input_variables=["year2"],
    template="{year2}年的欧冠联赛的冠军是哪支球队，只说球队名称。"
)
q3_prompt = PromptTemplate(
    input_variables=["team1", "team2"],
    template="{team1}和{team2}哪只球队获得欧冠的次数多一些？"
)

chain1 = (
    RunnableParallel({"year1": RunnablePassthrough()}) # 接收  {"year1": 2000, "year2": 2010}中的 year1 作为输入
    | q1_prompt
    | llm
    | (lambda x: {"team1": x.content})
)

chain2 = (
    RunnableParallel({"year2": RunnablePassthrough()})
    | q2_prompt
    | llm
    | (lambda x: {"team2": x.content})
)

chain3 = (
    # 同时接收 chain1 和 chain2 的输出（team1 和 team2）
    RunnableParallel(team1=RunnablePassthrough(), team2=RunnablePassthrough())
    | q3_prompt
    | llm
    | (lambda x: {"result": x.content})
)

sequential_chain = (
    # 并行执行 chain1 和 chain2
    RunnableParallel(
        chain1=RunnablePassthrough() | chain1,  # RunnablePassthrough() | chain1 会先将 ​整个输入字典 传递给 chain1，即 {"year1": 2000, "year2": 2010}
        chain2=RunnablePassthrough() | chain2   # 传递 year2 到 chain2
    )
    # 合并 chain1 和 chain2 的输出，传递给 chain3
    | (lambda x: {"team1": x["chain1"]["team1"], "team2": x["chain2"]["team2"]})
    | chain3
)

answer = sequential_chain.invoke({ "year1":2000, "year2":2010 })
print(answer["result"])