import os
import tiktoken
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

# 说明：原版使用 `openai.ChatCompletion.create(..., logit_bias=...)` 抑制"灾害"二字。
# OpenAI 1.x 的 chat.completions.create 同样支持 logit_bias 参数，
# 但需要将 token id 通过对应模型的 tokenizer 提前编码出来。
encoding = tiktoken.get_encoding('o200k_base')
token_ids = encoding.encode("灾害")
print(token_ids)

bias_map = {tid: -100 for tid in token_ids}

def make_text_short(text):
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "你是一个用来将文本改写得短的AI助手，用户输入一段文本，你给出一段意思相同，但是短小精悍的结果"},
            {"role": "user", "content": text},
        ],
        temperature=0.5,
        max_tokens=2048,
        presence_penalty=0,  # 出现过的 token 再次出现时的概率惩罚；0 表示不施加额外影响
        frequency_penalty=2,  # 重复出现的 token 概率惩罚；2 倾向于使用不同表述
        n=3,  # 让 AI 给我们返回 3 个答案供我们选择
        logit_bias=bias_map,
    )
    return completion


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
short_version = make_text_short(long_text)

for index, choice in enumerate(short_version.choices, start=1):
    print(f"version {index}: " + choice.message.content)
