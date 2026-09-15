import os
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

prefix = """在这个快节奏的现代社会中，我们每个人都面临着各种各样的挑战和困难。
在这些挑战和困难中，有些是由外部因素引起的，例如经济萧条、全球变暖和自然灾害等。\n"""
suffix = """\n面对这些挑战和困难，我们需要采取积极的态度和行动来克服它们。
这意味着我们必须具备坚韧不拔的意志和创造性思维，以及寻求外部支持的能力。
只有这样，我们才能真正地实现自己的潜力并取得成功。"""


def insert_text(prefix, suffix):
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "请你根据用户给到的 prefix 与 suffix，写一段衔接在 prefix 与 suffix 之间的过渡内容（不超过 1024 个 token）。"},
            {"role": "user", "content": f"prefix:\n{prefix}\nsuffix:\n{suffix}\n请输出衔接内容："},
        ],
        max_tokens=1024,
        temperature=0.7,
    )
    return completion.choices[0].message.content


# 说明：OpenAI Chat Completions API 不再支持原 Completion 接口的 prefix/suffix 续写参数；
# 这里改为通过 prompt 指令让模型生成衔接文本。
response = insert_text(prefix, suffix)
print(response)
