# Milvus的Schema
Schema 用于定义 Collections 的属性和其中的字段。类似于传统关系型数据库的表结构。

```python
from pymilvus import DataType, FieldSchema, CollectionSchema
id_field = FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, description="primary id")
age_field = FieldSchema(name="age", dtype=DataType.INT64, description="age")
embedding_field = FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=128, description="vector")

position_field = FieldSchema(name="position", dtype=DataType.VARCHAR, max_length=256, is_partition_key=True)

schema = CollectionSchema(fields=[id_field, age_field, embedding_field], auto_id=False, enable_dynamic_field=True, description="desc of a collection")

# 使用指定的 Schema 创建 Collections：
from pymilvus import Collection, connections
conn = connections.connect(host="127.0.0.1", port=19530)
collection_name1 = "tutorial_1"
collection1 = Collection(name=collection_name1, schema=schema, using='default', shards_num=2)
```

## 动态字段
Collections 的 Schema 中定义的所有字段都必须包含在要插入的实体中。如果希望某些字段是可选的，可以考虑启用动态字段。

对于启用了动态字段的 Collections，可以使用动态字段中的键进行标量过滤，就像使用模式中明确定义的字段一样。

```python
from pymilvus import MilvusClient

client= MilvusClient(uri="http://localhost:19530")

client.create_collection(
    collection_name="my_dynamic_collection",
    dimension=5,
    # highlight-next-line
    enable_dynamic_field=True
)
```

例如，假设您的 Collections Schema 只定义了两个字段，名为id 和vector, 但是你插入的数据里，
还有一个名为age的字段，在开启了动态字段的情况下，age将作为为键值对存储在动态字段中，你也可以使用age字段进行过滤。

## references
- https://milvus.io/docs/zh/schema.md
- https://milvus.io/docs/zh/enable-dynamic-field.md