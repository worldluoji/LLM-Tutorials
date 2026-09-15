"""
llama-index 0.9+ 迁移：
- GPTListIndex  → SummaryIndex
- LLMPredictor  → Settings.llm / 直接传入 LLM
- ServiceContext → Settings（全局）
- SimpleNodeParser 路径 → llama_index.core.node_parser.SimpleNodeParser
"""
import os

from langchain.text_splitter import SpacyTextSplitter
from llama_index.core import SummaryIndex, SimpleDirectoryReader, Settings
from llama_index.core.node_parser import SimpleNodeParser
from llama_index.llms.openai import OpenAI

os.environ.setdefault("OPENAI_API_KEY", os.environ.get("OPENAI_API_KEY", ""))

Settings.llm = OpenAI(model="gpt-4o-mini", temperature=0, max_tokens=1024)

# 使用 SpacyTextSplitter 来进行中文文本的分割，并限制每段不超过 2048 个 Token
text_splitter = SpacyTextSplitter(pipeline="zh_core_web_sm", chunk_size=2048)
parser = SimpleNodeParser(text_splitter=text_splitter)
documents = SimpleDirectoryReader("./articles").load_data()
nodes = parser.get_nodes_from_documents(documents)

# SummaryIndex 构建索引时不创建 Embedding，索引创建快且不消耗 Token
list_index = SummaryIndex(nodes=nodes)

response = list_index.as_query_engine(response_mode="tree_summarize").query(
    "下面鲁迅先生以第一人称'我'写的内容，请你用中文总结一下:"
)
print(response)
