# Text Embedding
在实际应用中，我们通常会使用文本嵌入模型（Text Embedding Models）来将文本转换为向量，而不是使用随机向量。

以下是几种常见的实现方式：

## 1. 使用Sentence Transformers库：
```py
from sentence_transformers import SentenceTransformer

# 2026 推荐（多语言/中文场景）：
# model = SentenceTransformer('BAAI/bge-m3')                    # 多语言，568 维，支持 8K 上下文
# model = SentenceTransformer('BAAI/bge-large-zh-v1.5')        # 中文专用，1024 维
# 英文轻量场景：
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')  # 384 维（轻量基线）

# 生成文本向量
vectors = model.encode(docs)
```

---

## 2. 使用Hugging Face的Transformers库：
```py
from transformers import AutoTokenizer, AutoModel
import torch

# 加载模型和分词器
model_name = "bert-base-uncased"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModel.from_pretrained(model_name)

# 生成文本向量
def get_embeddings(texts):
    # 对文本进行编码
    encoded_input = tokenizer(texts, padding=True, truncation=True, return_tensors='pt')
    
    # 获取BERT输出
    with torch.no_grad():
        model_output = model(**encoded_input)
    
    # 使用[CLS]标记的输出作为句子表示
    sentence_embeddings = model_output.last_hidden_state[:, 0, :]
    return sentence_embeddings.numpy()

vectors = get_embeddings(docs)
```

---

## 3. 使用大模型的API
例如：
- OpenAI `text-embedding-3-small`（1536 维，2026 主流）
- OpenAI `text-embedding-3-large` / `text-embedding-v4`（3072 维）
- 阿里 DashScope `text-embedding-v3` / `text-embedding-v4`
> 注：旧的 `text-embedding-ada-002`（已被 text-embedding-3-* 取代）与达摩院 `text-embedding-v1`（已下线）不再推荐。

---

## 选择建议：
- 通用中文/多语言 RAG：Sentence Transformers `BAAI/bge-m3`（首选）或 `BAAI/bge-large-zh-v1.5`
- 轻量英文基线：Sentence Transformers `all-MiniLM-L6-v2`
- 专业领域微调：Hugging Face Transformers，可选 `bert-base-uncased` 等基座
- 闭源 API（2026 推荐）：OpenAI `text-embedding-3-small/large`、DashScope `text-embedding-v3/v4`

---

在实际应用中，搜索时我们通常会：
- 先接收用户的查询文本
- 将查询文本转换为向量
- 用这个向量去搜索

```py
from sentence_transformers import SentenceTransformer

# 查询端必须使用与入库时一致的模型（如 bge-m3 / all-MiniLM-L6-v2）
model = SentenceTransformer('BAAI/bge-m3')
query_vector = model.encode(query_text)

res = client.search(
    collection_name="demo_collection",
    data=[query_vector],  # 使用转换后的查询向量
    filter="subject == 'history'",
    limit=2,
    output_fields=["text", "subject"],
)
```

一致性：
- 存储时用的encoder和搜索时用的encoder必须一致
- 创建collection时设置的dimension必须和存储数据时用的encoder的维度一致

如果使用不同的encoder：
- 即使文本意思相同，生成的向量也会完全不同
- 向量空间不一致，导致相似度计算失真
- 搜索结果会变得随机或无意义

---

## FastEmbed
`FastEmbed` 是由 Qdrant 团队开发的一个轻量级、高性能的本地 Embedding 模型库，专门为快速向量化文本和高效检索优化。以下是关于它的核心特性和使用场景的详细说明：

---

**1. FastEmbed 是什么？**
- 定位：专为 RAG（检索增强生成）和相似性搜索设计的轻量级本地嵌入模型库。

- 核心优势：

  - 极速推理：基于 Rust 实现，单 CPU 线程即可快速处理文本。

  - 低资源消耗：内存占用低（约 100MB），无需 GPU 加速。

  - 即用型模型：内置多种预训练模型（如 `BAAI/bge-base-en`、`nomic-embed-text-v2`、`snowflake-arctic-embed-s`）。

  - 量化支持：提供 8-bit 量化模型，进一步压缩模型体积。


---

**2. 基础使用**

**生成 Embedding 向量**
```python
from fastembed import TextEmbedding

# 初始化模型（自动下载预训练模型）
# 2026 推荐：多语言场景用 bge-base-en-v1.5 或 bge-m3
model = TextEmbedding(model_name="BAAI/bge-base-en-v1.5")

# 单条文本向量化
vector = model.embed("自然语言处理技术")[0]  # 输出维度默认 384/768

# 批量处理
texts = ["深度学习", "机器学习", "人工智能"]
vectors = list(model.embed(texts))  # 向量列表
```

---

**3. 与 Sentence-Transformers 对比**
| 特性               | FastEmbed                          | Sentence-Transformers             |
|------------------------|----------------------------------------|----------------------------------------|
| 推理速度            | 快（Rust 优化，单线程 10k docs/min）    | 较慢（Python + PyTorch）                |
| 内存占用            | 约 100MB                              | 约 1-2GB（取决于模型）                 |
| 模型体积            | 小（量化版 <50MB）                    | 大（通常 >300MB）                      |
| 多语言支持          | 部分模型支持                          | 广泛支持                              |
| 适用场景            | 大规模实时检索、边缘设备               | 高精度语义匹配、微调需求               |

---

**4. 集成 LangChain + Qdrant**
在 LangChain 中，FastEmbed 可直接作为 `embedding` 参数传入 `QdrantVectorStore`：
```python
from langchain_qdrant import QdrantVectorStore
from fastembed import TextEmbedding

# 初始化 FastEmbed
embeddings = TextEmbedding(model_name="snowflake/snowflake-arctic-embed-s")

# 存储到 Qdrant
qdrant = QdrantVectorStore.from_documents(
    docs=documents,
    embedding=embeddings,  # 直接传入 FastEmbed 实例
    url="http://localhost:6333",
    collection_name="fastembed_demo"
)
```

---

**5. 典型应用场景**
1. 实时 RAG 系统  
   结合 Qdrant 向量数据库，快速处理用户查询并检索相关文档。
   ```python
   # 查询示例
   query = "如何训练大语言模型？"
   query_vector = embeddings.embed(query)[0]
   results = qdrant.similarity_search(query_vector, k=5)
   ```

2. 边缘设备部署  
   在资源受限的设备（如树莓派）上运行，无需依赖云端 API。

3. 大规模数据预处理  
   对百万级文本快速生成向量，用于离线分析或索引构建。

---

**6. 最佳实践**
- 模型选择：

  - 通用场景（2026）：`BAAI/bge-m3`（多语言首选）或 `BAAI/bge-base-en-v1.5`（英文基线）。

  - 多语言/中文：`BAAI/bge-large-zh-v1.5`、`nomic-embed-text-v2`。

  - 极致轻量化：使用 `*-quantized` 量化模型（如 `BAAI/bge-base-en-v1.5-quantized`）。

- 性能调优：

  - 启用多线程批量处理（默认单线程）：

    ```python
    embeddings = TextEmbedding(parallel=4)  # 使用 4 线程
    ```

---

**总结**
- 推荐使用：若需快速构建本地化 RAG 系统或处理高吞吐量文本，FastEmbed 是优于 OpenAIEmbeddings 和传统 HuggingFace 模型的低成本替代方案。
- 避坑指南：避免在需要高精度语义匹配的场景中使用量化模型，优先选择标准版预训练模型。