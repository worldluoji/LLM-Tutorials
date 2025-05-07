from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from qdrant_client.models import Filter, FieldCondition, MatchValue

client = QdrantClient(url="http://127.0.0.1:6333")

collection_name="test_collection"

if client.collection_exists(collection_name):
    client.delete_collection(collection_name)

client.create_collection(
    collection_name=collection_name,
    vectors_config=VectorParams(size=4, distance=Distance.COSINE),
)


operation_info = client.upsert(
    collection_name=collection_name,
    wait=True,
    points=[
        PointStruct(id=1, vector=[0.05, 0.61, 0.76, 0.74], payload={"city": "Berlin"}),
        PointStruct(id=2, vector=[0.19, 0.81, 0.75, 0.11], payload={"city": "London"}),
        PointStruct(id=3, vector=[0.36, 0.55, 0.47, 0.94], payload={"city": "Moscow"}),
        PointStruct(id=4, vector=[0.18, 0.01, 0.85, 0.80], payload={"city": "New York"}),
        PointStruct(id=5, vector=[0.24, 0.18, 0.22, 0.44], payload={"city": "Beijing"}),
        PointStruct(id=6, vector=[0.35, 0.08, 0.11, 0.44], payload={"city": "Mumbai"}),
    ],
)

print(operation_info)


search_result = client.query_points(
    collection_name=collection_name,
    query=[0.2, 0.1, 0.9, 0.7],
    with_payload=False,
    limit=3
).points

print(search_result)
print("*" * 20)

search_result = client.query_points(
    collection_name=collection_name,
    query=[0.2, 0.1, 0.9, 0.7],
    query_filter=Filter(
        must=[FieldCondition(key="city", match=MatchValue(value="London"))]
    ),
    with_payload=True,
    limit=3,
).points

print(search_result)
print("*" * 20)

# 更新ID=2的元数据（保留原向量）
client.set_payload(
    collection_name=collection_name,
    payload={"city": "ChengDu"},
    points=[2],
)

# -------------------- 删除数据（Delete） --------------------
client.delete(collection_name=collection_name, points_selector=[1])

records, _ = client.scroll(
    collection_name=collection_name,
    limit=10,          # 限制返回10条
    with_payload=True, # 包含元数据
)

print(records)
print("*" * 20)


# 删除集合及其所有数据
client.delete_collection(collection_name=collection_name)
print(f"集合 {collection_name} 及其所有数据已删除")