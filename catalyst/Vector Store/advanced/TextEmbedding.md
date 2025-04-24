# Text Embedding
在实际应用中，我们通常会使用文本嵌入模型（Text Embedding Models）来将文本转换为向量，而不是使用随机向量。

以下是几种常见的实现方式：

## 1. 使用Sentence Transformers库：
```py
from sentence_transformers import SentenceTransformer

# 加载模型
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')  # 384维向量
# 或者使用更强大的模型
# model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')  # 768维向量

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
比如OpenAI的API、阿里的API等

---

## 选择建议：
- 如果你需要快速实现文本相似度搜索，用Sentence Transformers
- 如果你的应用场景特殊（如医疗、法律等专业领域），用Hugging Face Transformers，这样可以：
  - 选择领域相关的预训练模型
  - 自定义向量提取方式
  - 进行领域适应性训练
- 如果预算充足且追求最好的效果，用大模型的API

---

在实际应用中，搜索时我们通常会：
- 先接收用户的查询文本
- 将查询文本转换为向量
- 用这个向量去搜索

```py
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
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