import os
import numpy as np
import pandas as pd
import tiktoken
from openai import OpenAI

# embedding model parameters
embedding_model = "text-embedding-3-small"
embedding_encoding = "cl100k_base"  # cl100k_base 兼容 text-embedding-3-* 系列
max_tokens = 8000  # text-embedding-3-* 单次输入上限

# load & inspect dataset. The data comes from https://www.kaggle.com/datasets/snap/amazon-fine-food-reviews
input_datapath = "data/fine_food_reviews_1k.csv"  # to save space, we provide a pre-filtered dataset
df = pd.read_csv(input_datapath, index_col=0)
df = df[["Time", "ProductId", "UserId", "Score", "Summary", "Text"]]
df = df.dropna()
df["combined"] = (
    "Title: " + df.Summary.str.strip() + "; Content: " + df.Text.str.strip()
)
df.head(2)

# subsample to 1k most recent reviews and remove samples that are too long
top_n = 1000
df = df.sort_values("Time").tail(top_n * 2)  # first cut to first 2k entries, assuming less than half will be filtered out
df.drop("Time", axis=1, inplace=True)

encoding = tiktoken.get_encoding(embedding_encoding)

# omit reviews that are too long to embed
df["n_tokens"] = df.combined.apply(lambda x: len(encoding.encode(x)))
df = df[df.n_tokens <= max_tokens].tail(top_n)
len(df)

# Ensure you have your API key set in your environment per the README: https://github.com/openai/openai-python#usage
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def get_embedding(text, model=embedding_model):
    response = client.embeddings.create(model=model, input=text)
    return np.array(response.data[0].embedding)


# Save to CSV for further useage. This may take a few minutes
df["embedding"] = df.combined.apply(lambda x: get_embedding(x))
df.to_csv("data/fine_food_reviews_with_embeddings_1k.csv")

# https://github.com/openai/openai-cookbook/blob/4c31db4987f82068b0942dc6b84bf71c1d714418/examples/Obtain_dataset.ipynb
