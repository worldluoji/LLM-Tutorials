"""
llama-index 0.9+ 迁移：
- GPTSimpleVectorIndex → VectorStoreIndex
- QuestionAnswerPrompt → PromptTemplate
- verbose 参数改为在 QueryEngine 上设置 response_mode / streaming 等

如需 OCR 解析图片，建议改用 LlamaParse（https://docs.llamaindex.ai/en/stable/llama_cloud/llama_parse/）。
"""
import os
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Settings, PromptTemplate
from llama_index.llms.openai import OpenAI

os.environ.setdefault("OPENAI_API_KEY", os.environ.get("OPENAI_API_KEY", ""))
Settings.llm = OpenAI(model="gpt-4o-mini", temperature=0)

TARGET_PATH = "./index_tyxs.json"

if not os.path.exists(TARGET_PATH):
    documents = SimpleDirectoryReader("./articles").load_data()
    index = VectorStoreIndex.from_documents(documents)
    index.storage_context.persist(persist_dir=TARGET_PATH)

# 0.9+ 中使用 StorageContext.load / load_from_disk 读取
from llama_index.core import StorageContext, load_index_from_storage

storage_context = StorageContext.from_defaults(persist_dir=TARGET_PATH)
index = load_index_from_storage(storage_context)

query_engine = index.as_query_engine()
response = query_engine.query("鲁迅先生在日本学习医学的老师是谁？")
print(response)

# verbose 已从 query() 移至 streaming/similarity_top_k 等参数；如需调试可打印 source_nodes
response = query_engine.query("鲁迅先生是去哪里学的医学？")
print(response)
for node in response.source_nodes:
    print(f"score={node.score:.4f} text={node.text[:120]}")


# PromptTemplate 的等价实现
DEFAULT_TEXT_QA_PROMPT_TMPL = (
    "Context information is below. \n"
    "---------------------\n"
    "{context_str}"
    "\n---------------------\n"
    "Given the context information and not prior knowledge, "
    "answer the question: {query_str}\n"
)
QA_PROMPT = PromptTemplate(DEFAULT_TEXT_QA_PROMPT_TMPL)

response = index.as_query_engine(text_qa_template=QA_PROMPT).query("鲁迅先生去哪里学的医学？")
print(response)
