import re
import json
import os

from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import TextLoader, CSVLoader
from langchain_community.embeddings import HuggingFaceEmbeddings

# from langchain_openai import OpenAIEmbeddings
from langchain_openai.chat_models.base import BaseChatOpenAI

from langchain.chains import VectorDBQA
from langchain.agents import initialize_agent, tool
from langchain.text_splitter import CharacterTextSplitter, RecursiveCharacterTextSplitter 

from dotenv import load_dotenv


load_dotenv()

llm = BaseChatOpenAI(
    model='deepseek-chat',  # 使用DeepSeek聊天模型
    openai_api_key=os.environ.get("deepseek"),  # 替换为你的API易API密钥
    openai_api_base='https://api.deepseek.com',  # API易的端点
    max_tokens=1024,  # 设置最大生成token数,
    temperature=0
)


loader = TextLoader('../data/ecommerce_faq.txt')
documents = loader.load()

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=256,
    chunk_overlap=20,
    separators=["\n\n", "\n", "。", "！", "？", "，", "、", ""]
)

texts = text_splitter.split_documents(documents)

# embeddings = OpenAIEmbeddings()
# 使用多语言模型（支持中文）
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
    model_kwargs={'device': 'cpu'},  # 指定使用 CPU
    encode_kwargs={'normalize_embeddings': False}
)

docsearch = FAISS.from_documents(texts, embeddings)

faq_chain = VectorDBQA.from_chain_type(llm=llm, vectorstore=docsearch, verbose=True)


# 我们通过 @tool 这个 Python 的 decorator 功能，将 FAQ 这个函数直接变成了 Tool 对象，这可以减少我们每次创建 Tools 的时候都要指定 name 和 description 的工作。
@tool("FAQ")
def faq(intput: str) -> str:
    """"useful for when you need to answer questions about shopping policies, like return policy, shipping policy, etc."""
    return faq_chain.run(intput)

# 对于商品推荐，我们可以如法炮制，也把对应的信息，存到 VectorStore 里，然后通过先搜索后问答的方式来解决
product_loader = CSVLoader('../data/ecommerce_products.csv')
product_documents = product_loader.load()
product_text_splitter = CharacterTextSplitter(chunk_size=1024, separator="\n")
product_texts = product_text_splitter.split_documents(product_documents)

embeddings2 = HuggingFaceEmbeddings(
    model_name="sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
    model_kwargs={'device': 'cpu'},  # 指定使用 CPU
    encode_kwargs={'normalize_embeddings': False}
)

product_search = FAISS.from_documents(product_texts, embeddings2)
product_chain = VectorDBQA.from_chain_type(llm=llm, vectorstore=product_search, verbose=True)

@tool("Recommend Product")
def recommend_product(input: str) -> str:
    """"useful for when you need to search and recommend products and recommend it to the user"""
    return product_chain.run(input)


# 假数据
ORDER_1 = "20230101ABC"
ORDER_2 = "20230101EFG"

ORDER_1_DETAIL = {
    "order_number": ORDER_1,
    "status": "已发货",
    "shipping_date" : "2023-01-03",
    "estimated_delivered_date": "2023-01-05",
} 

ORDER_2_DETAIL = {
    "order_number": ORDER_2,
    "status": "未发货",
    "shipping_date" : None,
    "estimated_delivered_date": None,
}

@tool("Search Order")
def search_order(input:str)->str:
    """一个帮助用户查询最新订单状态的工具，并且能处理以下情况：
    1. 在用户没有输入订单号的时候，会询问用户订单号
    2. 在用户输入的订单号查询不到的时候，会让用户二次确认订单号是否正确"""
    pattern = r"\d+[A-Z]+"
    match = re.search(pattern, input)

    order_number = input
    if match:
        order_number = match.group(0)
    else:
        return "请问您的订单号是多少？"
    if order_number == ORDER_1:
        return json.dumps(ORDER_1_DETAIL)
    elif order_number == ORDER_2:
        return json.dumps(ORDER_2_DETAIL)
    else:
        return f"对不起，根据{input}没有找到您的订单"

tools = [
    search_order,
    recommend_product,
    faq
]

agent = initialize_agent(tools, llm, agent="zero-shot-react-description", verbose=True)

question = "请问你们的货，能送到三亚吗？大概需要几天？"
result = agent.invoke(question)
print(result)

question = "我想买一件衣服，想要在春天去公园穿，但是不知道哪个款式好看，你能帮我推荐一下吗？"
answer = agent.invoke(question)
print(answer)

question = "我有一张订单，订单号是 2022ABCDE，一直没有收到，能麻烦帮我查一下吗？"
answer = agent.invoke(question)
print(answer)