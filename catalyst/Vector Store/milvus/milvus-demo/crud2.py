from pymilvus import MilvusClient
from sentence_transformers import SentenceTransformer

client = MilvusClient("./milvus_demo.db")

if client.has_collection(collection_name="demo_collection"):
    client.drop_collection(collection_name="demo_collection")


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


# 加载模型
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')  # 384维向量

# 生成文本向量
vectors = model.encode(docs)
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
'''
# Delete entities by primary key
res = client.delete(collection_name="demo_collection", ids=[0, 2])
'''

print(res)