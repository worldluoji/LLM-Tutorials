# Milvus加载和释放
加载集合是在集合中进行相似性搜索和查询的前提。加载 Collections 时，Milvus 会将所有索引文件和每个字段中的原始数据加载到内存中，以便快速响应搜索和查询。

搜索和查询是内存密集型操作。为节约成本，建议您释放当前不使用的 Collections

## references
https://milvus.io/docs/zh/load-and-release.md