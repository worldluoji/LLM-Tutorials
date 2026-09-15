import os
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

prompt = '请你用朋友的语气回复给到客户，并称他为"亲"，他的订单已经发货在路上了，预计在3天之内会送达，订单号2021AEDG，我们很抱歉因为天气的原因物流时间比原来长，感谢他选购我们的商品。'

def get_response(prompt, temperature=1.0):
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "你是一个友好、温暖且真诚的客服助手。"},
            {"role": "user", "content": prompt},
        ],
        max_tokens=1024,
        n=1,
        temperature=temperature,
    )
    return completion.choices[0].message.content

print(get_response(prompt))
