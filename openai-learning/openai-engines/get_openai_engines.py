"""
OpenAI 已于 2024 年下线 `openai.Engine.list()` 接口。

可用替代：
1. SDK 列表：`client.models.list()`（OpenAI >= 1.0）
2. 控制台查看：https://platform.openai.com/docs/models

下方给出基于 `client.models.list()` 的等价实现。
"""
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

models = client.models.list()
for m in models.data:
    print(f"{m.id}\t{m.owned_by}")
