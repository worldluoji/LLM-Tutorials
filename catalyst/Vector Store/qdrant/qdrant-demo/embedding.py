
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'  # 使用镜像站
from sentence_transformers import SentenceTransformer

docs = [
    "Artificial intelligence was founded as an academic discipline in 1956.",
    "Alan Turing was the first person to conduct substantial research in AI.",
    "Born in Maida Vale, London, Turing was raised in southern England.",
]

# 加载模型
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')  # 384维向量

# 生成文本向量
vectors = model.encode(docs)
print(len(vectors[0]))
print("*" * 20)


client = QdrantClient(url="http://127.0.0.1:6333", check_compatibility=False)

collection_name="test_collection"

if client.collection_exists(collection_name):
    client.delete_collection(collection_name)

client.create_collection(
    collection_name=collection_name,
    vectors_config=VectorParams(size=384, distance=Distance.COSINE),
)

points = []
for i,v in enumerate(vectors):
    points.append(PointStruct(id=i+1, vector=v))

operation_info = client.upsert(
    collection_name=collection_name,
    wait=True,
    points=points,
)

print(operation_info)
print("*" * 20)

query = model.encode(["research in AI"])[0]

search_result = client.query_points(
    collection_name=collection_name,
    query=query,
    with_payload=False,
    limit=3
).points

print(search_result)
