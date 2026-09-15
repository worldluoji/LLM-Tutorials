import os
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

class Conversation:
    '''
        prompt 作为 system 的 content, 代表我们对这个聊天机器人的指令
        num_of_round 代表每次向 ChatGPT 发起请求的时候，保留过去几轮会话
    '''
    def __init__(self, prompt, num_of_round=3):
        self.prompt = prompt
        self.num_of_round = num_of_round
        self.messages = []
        self.messages.append({"role": "system", "content": self.prompt})


    '''
        每次调用 ask 函数，都会向 ChatGPT 发起一个请求。
        在这个请求里，我们都会把最新的问题拼接到整个对话数组的最后，而在得到 ChatGPT 的回答之后也会把回答拼接上去。
        如果回答完之后，发现会话的轮数超过我们设置的 num_of_round, 我们就去掉最前面的一轮会话。
    '''
    def ask(self, question):
        try:
            self.messages.append({"role": "user", "content": question})
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=self.messages,
                temperature=0.5,
                max_tokens=2048,
                top_p=1,
            )
        except Exception as e:
            print(e)
            return e

        message = completion.choices[0].message.content
        self.messages.append({"role": "assistant", "content": message})

        if len(self.messages) > self.num_of_round * 2 + 1:
            del self.messages[1: 3]  # Remove the first round conversation left
        return message


prompt = """你是一个中国厨师，用中文回答做菜的问题。你的回答需要满足以下要求:
1. 你的回答必须是中文
2. 回答限制在100个字以内"""
conv1 = Conversation(prompt, 2)
question1 = "你是谁？"
print("User : %s" % question1)
print("Assistant : %s\n" % conv1.ask(question1))

question2 = "请问宫保鸡丁怎么做？"
print("User : %s" % question2)
print("Assistant : %s\n" % conv1.ask(question2))

question3 = "那火爆牛舌呢？"
print("User : %s" % question3)
print("Assistant : %s\n" % conv1.ask(question3))

question4 = "我问你的第一个问题是什么？"
print("User : %s" % question4)
print("Assistant : %s\n" % conv1.ask(question4))
