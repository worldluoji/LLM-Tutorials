# Milvus 分区
创建一个 Collection 时，Milvus 也会在该 Collection 中创建一个名为_default 的分区。如果不添加其他分区，所有插入到 Collections 中的实体都会进入默认分区，所有搜索和查询也都在默认分区内进行。

您可以添加更多分区，并根据特定条件将实体插入其中。这样就可以限制在某些分区内进行搜索和查询，从而提高搜索性能。

一个 Collections 最多可以有 1,024 个分区。

```py
client.create_partition(
    collection_name="quick_setup",
    partition_name="partitionA"
)

res = client.list_partitions(
    collection_name="quick_setup"
)

print(res)
```

## references
https://milvus.io/docs/zh/manage-partitions.md