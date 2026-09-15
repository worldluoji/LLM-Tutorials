"""
llama-index 0.9+ 迁移说明：
- GPTSimpleVectorIndex → VectorStoreIndex
- DEFAULT_FILE_EXTRACTOR / ImageParser 路径已迁移到 llama_index.core.readers.file.base 等
- display_response / display_image 改为 ipython 风格输出
- ImageOutputQueryTransform 路径变为 llama_index.core.query.query_transform.image

下方为基于 llama-index 0.9+ 的等价示例；如需 OCR 解析图片，可使用 LlamaParse 等替代方案。
"""
import os
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Settings
from llama_index.llms.openai import OpenAI

os.environ.setdefault("OPENAI_API_KEY", os.environ.get("OPENAI_API_KEY", ""))
Settings.llm = OpenAI(model="gpt-4o-mini", temperature=0)

documents = SimpleDirectoryReader("./pics").load_data()
index = VectorStoreIndex.from_documents(documents)

query_engine = index.as_query_engine()
response = query_engine.query(
    "When was the last time I went to McDonald's and how much did I spend?"
)
print(response)

# 打印 SimpleDirectoryReader 加载的原始文本
print("*" * 13)
for doc in documents:
    print(doc.text[:500])
