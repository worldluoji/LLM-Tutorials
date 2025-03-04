from pymilvus import MilvusClient
import numpy as np

client = MilvusClient("./milvus_demo.db")

if client.has_collection(collection_name="demo_collection"):
    client.drop_collection(collection_name="demo_collection")

client.create_collection(
    collection_name="demo_collection",
    dimension=384,  # The vectors we will use in this demo has 384 dimensions
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
res = client.insert(
    collection_name="demo_collection",
    data=data
)

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