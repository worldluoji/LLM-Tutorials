# qdrant-demo

Qdrant 向量数据库的最小可运行示例，覆盖两条最常见的链路：

- `crud.py` —— 创建 collection、写入/更新/检索点、按 payload 过滤
- `embedding.py` —— 用 `sentence-transformers` 把真实文本转成向量后入库与检索

## 运行前置

- 启动本地 Qdrant 服务（默认监听 `http://127.0.0.1:6333`）：
  ```bash
  docker run -p 6333:6333 -p 6334:6334 \
      -v $(pwd)/qdrant_storage:/qdrant/storage:z \
      qdrant/qdrant
  ```
- Python ≥ 3.13（见 `pyproject.toml`），依赖通过 `uv sync` 安装。

## 跑示例

```bash
uv sync
uv run python crud.py        # 4 维向量的基础 CRUD + 过滤查询
uv run python embedding.py   # 384 维 sentence-transformers 向量入库
```

`embedding.py` 默认通过 `https://hf-mirror.com` 拉取 `all-MiniLM-L6-v2`，如需更换嵌入模型（例如换成 `BAAI/bge-m3` 或 `BAAI/bge-large-zh-v1.5` 以更好地支持中文），同时记得把 `VectorParams(size=...)` 的维度调成新模型对应的输出维度。

## 配套文档

- 上层原理与对比：[`../常用向量数据库.md`](../常用向量数据库.md)
- 项目背景与安装：[`../Qdrant.md`](../Qdrant.md)
