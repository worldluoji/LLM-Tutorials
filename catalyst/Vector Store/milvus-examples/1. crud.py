from pymilvus import MilvusClient
import numpy as np

client = MilvusClient("./milvus_demo.db")

if client.has_collection(collection_name="demo_collection"):
    client.drop_collection(collection_name="demo_collection")


'''
关于维度大小的选择：

更小的维度（如64、128）：
优点：存储空间更少，检索速度更快
缺点：可能无法充分表达复杂的语义信息

更大的维度（如512、768）：
优点：可以存储更丰富的特征信息
缺点：需要更多存储空间，检索速度相对较慢
'''
client.create_collection(
    collection_name="demo_collection",
    dimension=384,  # dimension参数定义了向量的维度，也就是用多少个数字来表示一个向量
)

# Text strings to search from.
docs = [
    "Artificial intelligence was founded as an academic discipline in 1956.",
    "Alan Turing was the first person to conduct substantial research in AI.",
    "Born in Maida Vale, London, Turing was raised in southern England.",
]

'''
如果由于网络问题无法下载模型，作为一种走马观花的方法，你可以使用随机向量来表示文本，仍然可以完成示例。
只需注意，由于向量是假向量，搜索结果不会反映语义相似性。

np.random.uniform(-1, 1)：生成一个在 -1 到 1 之间的随机浮点数。

for _ in range(384)：生成一个包含 384 个随机数的列表，每个随机数在 -1 到 1 之间。

for _ in range(len(docs))：为 docs 中的每个文本生成一个这样的 384 维向量。

最终, vectors 部分为每个文本生成了一个 384 维的随机向量，通常这些向量是通过某种嵌入模型（如 BERT、Word2Vec 等）生成的，但这里为了示例使用了随机数。
'''
vectors = [[ np.random.uniform(-1, 1) for _ in range(384) ] for _ in range(len(docs)) ]
data = [ {"id": i, "vector": vectors[i], "text": docs[i], "subject": "history"} for i in range(len(vectors)) ]


'''
在实际应用中，我们通常会使用文本嵌入模型（Text Embedding Models）来将文本转换为向量，而不是使用随机向量
以下是几种常见的实现方式：

1. 使用Sentence Transformers库：
--------------------------------
from sentence_transformers import SentenceTransformer

# 加载模型
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')  # 384维向量
# 或者使用更强大的模型
# model = SentenceTransformer('sentence-transformers/all-mpnet-base-v2')  # 768维向量

# 生成文本向量
vectors = model.encode(docs)
--------------------------------

2. 使用Hugging Face的Transformers库：
--------------------------------
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
--------------------------------
选择建议：
- 如果你需要快速实现文本相似度搜索，用Sentence Transformers
- 如果你的应用场景特殊（如医疗、法律等专业领域），用Hugging Face Transformers，这样可以：
  - 选择领域相关的预训练模型
  - 自定义向量提取方式
  - 进行领域适应性训练
- 如果预算充足且追求最好的效果，用OpenAI的API
'''



res = client.insert(
    collection_name="demo_collection",
    data=data
)


'''
在实际应用中，搜索时我们通常会：
- 先接收用户的查询文本
- 将查询文本转换为向量
- 用这个向量去搜索

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

一致性：
- 存储时用的encoder和搜索时用的encoder必须一致
- 创建collection时设置的dimension必须和存储数据时用的encoder的维度一致

如果使用不同的encoder：
- 即使文本意思相同，生成的向量也会完全不同
- 向量空间不一致，导致相似度计算失真
- 搜索结果会变得随机或无意义
'''
# This will exclude any text in "history" subject despite close to the query vector.
res = client.search(
    collection_name="demo_collection",
    data=[vectors[0]],
    filter="subject == 'history'",
    limit=2,
    output_fields=["text", "subject"],
)
print(res)
print("*" * 10)

# a query that retrieves all entities matching filter expressions.
res = client.query(
    collection_name="demo_collection",
    filter="subject == 'history'",
    output_fields=["text", "subject"],
)
print(res)
print("*" * 10)


# delete
res = client.delete(
    collection_name="demo_collection",
    filter="subject == 'history'",
)
print(res)