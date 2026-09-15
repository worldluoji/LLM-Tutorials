import os
import time
import numpy as np
import pandas as pd
import tiktoken
from openai import OpenAI

embedding_model = "text-embedding-3-small"
embedding_encoding = "cl100k_base"  # cl100k_base 兼容 text-embedding-3-* 系列
batch_size = 2000
max_tokens = 8000  # text-embedding-3-small 单条输入上限

# 1. 对数据做预处理，过滤掉数据里面有些文本是空的情况，以及把 Token 数量太多的给过滤掉。
df = pd.read_csv('20_newsgroup.csv')
print("Number of rows before null filtering:", len(df))
df = df[df['text'].isnull() == False]
encoding = tiktoken.get_encoding(embedding_encoding)

df["n_tokens"] = df.text.apply(lambda x: len(encoding.encode(x)))
print("Number of rows before token number filtering:", len(df))
df = df[df.n_tokens <= max_tokens]
print("Number of rows data used:", len(df))

# 2. 通过 Embedding 的接口，拿到文本的 Embedding 向量，然后把整个数据存储成 parquet 文件

# 如果直接一条条调用 OpenAI 的 API，很快就会遇到报错。OpenAI 对 API 的调用进行了限速（Rate Limit），
# 如果过于频繁地调用就会遇到限速报错。这里用一个简单的重试 + 指数退避实现来替代原 openai.error.RateLimitError 的 backoff 装饰器。
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))


def get_embeddings_with_backoff(texts, model, max_retries=5, base_delay=2.0):
    embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        for attempt in range(max_retries):
            try:
                response = client.embeddings.create(model=model, input=batch)
                embeddings.extend([np.array(d.embedding) for d in response.data])
                break
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                wait = base_delay * (2 ** attempt)
                print(f"Rate limited, retrying in {wait:.1f}s ({attempt + 1}/{max_retries}): {e}")
                time.sleep(wait)
    return embeddings


prompts = df.text.tolist()
# range(start, stop, step), range(0, 5) 等价于 range(0, 5, 1)
prompt_batches = [prompts[i:i + batch_size] for i in range(0, len(prompts), batch_size)]

embeddings = []
count = 1
for batch in prompt_batches:
    print('begin to get ' + str(count) + ' batch')
    count = count + 1
    batch_embeddings = get_embeddings_with_backoff(texts=batch, model=embedding_model)
    embeddings += batch_embeddings

df["embedding"] = embeddings
df.to_parquet("20_newsgroup_with_embedding.parquet", index=False)
