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

# ===== 1. 定义提示词模板（保持不变）=====
en_to_zh_prompt = PromptTemplate(
    template="请把下面这句话翻译成英文：\n\n{question}",
    input_variables=["question"]
)

question_prompt = PromptTemplate(
    template="{english_question}",
    input_variables=["english_question"]
)

en_to_cn_prompt = PromptTemplate(
    template="请把下面这一段翻译成中文：\n\n{english_answer}",
    input_variables=["english_answer"]
)

# ===== 2. 重构 Chain（关键修复）=====
# 链1：问题翻译（中→英）
question_translate_chain = (
    RunnableParallel({"question": RunnablePassthrough()})  # 明确输入字段
    | en_to_zh_prompt
    | llm
    | (lambda x: {"english_question": x.content})
)

# 链2：生成英文答案
qa_chain = (
    RunnableParallel({"english_question": RunnablePassthrough()})
    | question_prompt
    | llm
    | (lambda x: {"english_answer": x.content})
)

# 链3：答案翻译（英→中）
answer_translate_chain = (
    RunnableParallel({"english_answer": RunnablePassthrough()})
    | en_to_cn_prompt
    | llm
    | (lambda x: {"answer": x.content})
)

# ===== 3. 组合完整流程 =====
chinese_qa_chain = (
    RunnablePassthrough()  # 输入为字符串（如用户问题）
    | question_translate_chain
    | qa_chain
    | answer_translate_chain
)

# ===== 4. 执行链 =====
response = chinese_qa_chain.invoke(
    "请你作为一个有远程工作经验的IT专家，在我已经熟悉JS、NodeJS、python、React、Vue的前提下，介绍一下外国人如何找到一份英语国家的远程IT工作"
)
print(response["answer"])