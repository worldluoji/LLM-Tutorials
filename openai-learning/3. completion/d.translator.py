import os
import tiktoken
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

def translate(text):
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "你是一个翻译，把用户的话翻译成英文"},
            {"role": "user", "content": text},
        ],
        temperature=0.5,
        max_tokens=2048,
        n=1,
    )
    return completion.choices[0].message.content


long_text = """
根据最近的报告，中国的消费者价格指数（CPI）同比增长0.7％，低于2月份1％的增长。
与此同时，上个月生产者价格指数（PPI）同比下降2.5％，低于去年同期下降1.4％。
这表明中国的经济目前正在经历生产者价格的通缩和消费者价格通胀放缓。
在这个快节奏的现代社会中，我们每个人都面临着各种各样的挑战和困难。
在这些挑战和困难中，有些是由外部因素引起的，例如经济萧条、全球变暖和自然灾害等。
还有一些是由内部因素引起的，例如情感问题、健康问题和自我怀疑等。
面对这些挑战和困难，我们需要采取积极的态度和行动来克服它们。
这意味着我们必须具备坚韧不拔的意志和创造性思维，以及寻求外部支持的能力。
"""

chinese = long_text
english = translate(chinese)

encoding = tiktoken.get_encoding('o200k_base')
num_of_tokens_in_chinese = len(encoding.encode(chinese))
num_of_tokens_in_english = len(encoding.encode(english))

print(english)
print(f"chinese: {num_of_tokens_in_chinese} tokens")
print(f"english: {num_of_tokens_in_english} tokens")
