# Completion
Completion 这个接口里面的参数:
1. 第一个参数是 engine，也就是我们使用的是 Open AI 的哪一个引擎，这里我们使用的是 text-davinci-003，也就是现在可以使用到的最擅长根据你的指令输出内容的模型。当然，也是调用成本最高的模型。
2. 第二个参数是 prompt，是我们输入的提示语。
3. 第三个参数是 max_tokens，也就是调用生成的内容允许的最大 token 数量。你可以简单地把 token 理解成一个单词。有时候，一个单词会被分解成两个 token。比如，icecream 是一个单词，但是实际在大语言模型里，会被拆分成 ice 和 cream 两个 token。这里用的 text-davinci-003 模型，允许最多有 4096 个 token。
4. 第四个参数 n，代表你希望 AI 给你生成几条内容供你选择。在这样自动生成客服内容的场景里，我们当然设置成 1。但是如果在一些辅助写作的场景里，你可以设置成 3 或者更多，供用户在多个结果里面自己选择自己想要的。
5. 第五个参数 stop，代表你希望模型输出的内容在遇到什么内容的时候就停下来。这个参数我们常常会选用 "\n\n"这样的连续换行，因为这通常意味着文章已经要另起一个新的段落了，既会消耗大量的 token 数量，又可能没有必要

## Completion basic examples
### -> prompt.py
相同的提示语，连续调用两次之后，给到了含义相同、遣词造句不同的结果。

每次回复的内容不一样，则归功于我们使用的一个参数 temperature。这个参数的输入范围是 0-2 之间的浮点数，代表输出结果的随机性或者说多样性。在这里，我们选择了 1.0，也就是还是让每次生成的内容都有些不一样。你也可以把这个参数设置为 0，这样，每次输出的结果的随机性就会比较小。

这个参数该怎么设置，取决于实际使用的场景。如果对应的场景比较严肃，不希望出现差错，那么设得低一点比较合适，比如银行客服的场景。如果场景没那么严肃，有趣更加重要，比如讲笑话的机器人，那么就可以设置得高一些。

注意：
```
Temperature 作为一个参数，其实是决定了我们在 AI 大模型生成下一个 Token 的候选列表的时候，高概率的 Token 被选中的概率的分布是更大还是更小。
即使 Temperature 设置成 0，也并不意味着模型的输出是一样的。
```

<br>

### -> food_chatbot.py
GPT 的模型，要完成支持多轮的问答也并不复杂。

我们只需要在提示语里，在问题之前加上 “Q :” 表示这是一个问题，然后另起一行，加上 “A :” 表示我想要一个回答，那么 Completion 的接口就会回答你在 “Q : ” 里面跟的问题。

要完成多轮对话其实也不麻烦，只要把之前对话的内容也都放到提示语里面，把整个上下文都提供给 AI。AI 就能够自动根据上下文，回答第二个问题。比如：
```
question =  """
Q : 鱼香肉丝怎么做？
A : 
1.准备好食材：500克猪里脊肉，2个青椒，2个红椒，1个洋葱，2勺蒜蓉，3勺白糖，适量料酒，半勺盐，2勺生抽，2勺酱油，2勺醋，少许花椒粉，半勺老抽，适量水淀粉。
2.将猪里脊肉洗净，沥干水分，放入料酒、盐，抓捏抓匀，腌制20分钟。
3.将青红椒洗净，切成丝，洋葱洗净，切成葱花，蒜末拌入小苏打水中腌制。
4.将猪里脊肉切成丝，放入锅中，加入洋葱，炒制至断生，加入青红椒，炒匀，加入腌制好的蒜末，炒制至断生。
5.将白糖、生抽、酱油、醋、花椒粉、老抽、水淀粉倒入锅中，翻炒匀，用小火收汁，调味即可。

Q : 那蚝油牛肉呢？
A : 
"""
print(get_response(question))
```
想要退出的时候，就在需要提问的时候，输入 “bye” 就好了。

<br>

## ChatCompletion
在 2023 年 3 月 2 日，因为 ChatGPT 的火热，OpenAI 放出了一个直接可以进行对话聊天的接口。
这个接口叫做 ChatCompletion，对应的模型叫做 gpt-3.5-turbo，不但用起来更容易了，速度还快，
而且价格也是我们之前使用的 text-davinci-003 的十分之一，可谓是物美价廉了。
```
import openai
openai.ChatCompletion.create(
  model="gpt-3.5-turbo",
  messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Who won the world series in 2020?"},
        {"role": "assistant", "content": "The Los Angeles Dodgers won the World Series in 2020."},
        {"role": "user", "content": "Where was it played?"}
    ]
)
```
Prompt 变成了一个数组，数组的每个元素都有 role 和 content 两个字段。
- role 这个字段一共有三个角色可以选择，其中 system 代表系统，user 代表用户，而 assistant 则代表 AI 的回答。
- 当 role 是 system 的时候，content 里面的内容代表我们给 AI 的一个指令，也就是告诉 AI 应该怎么回答用户的问题。比如我们希望 AI 都通过中文回答，我们就可以在 content 里面写“你是一个只会用中文回答问题的助理”，这样即使用户问的问题都是英文的，AI 的回复也都会是中文的。
- 当 role 是 user 或者 assistant 的时候，content 里面的内容就代表用户和 AI 对话的内容。

<br>

## ChatCompletion examples
1. 归纳总结： -> c.make_short.py
2. 翻译: -> d.translator.py
3. 文本改写: -> e.change_text.py  text-davinci-003 这个模型有个特殊的功能，就是“插入文本”（Inserting Text）。某种意义上来说，你也可以通过这个功能来做文本改写。
4. Conversation -> f.conversation.py

<br>

## JSON格式返回
```
CHAT_COMPLETION_MODEL = "gpt-3.5-turbo-0125"
def get_json_response(prompt, model=CHAT_COMPLETION_MODEL):
    messages = [
        {"role" : "system", "content" : "You are an useful AI asssitant."},
        {"role" : "user", "content": prompt}
    ]
    response = client.chat.completions.create (
        model=model,
        messages=messages,
        max_tokens=512,
        n=1,
        stop=None,
        temperature=0.7, 
        response_format={ "type": "json_object" },      
    )
    message = response.choices[0].message.content
    return message

prompt = """
Hi,

Could you write me a title, 5 selling points, and a price range for a product called "工厂现货PVC充气青蛙夜市地摊热卖充气玩具发光蛙儿童水上玩具" in English in json format?

The json format should be like this:

{
    "title": "Blablabla",
    "selling_points": [
        "Blablabla",
        "Blablabla",
        "Blablabla",
        "Blablabla",
        "Blablabla"
    ],
    "price_range": "$x.00 - $y.00"
}

"""

print(get_json_response(prompt)) 
```
首先，只有在使用 gpt-4-turbo-preview 或者 gpt-3.5-turbo-0125 这两个模型的时候，OpenAI 的 API 才支持指定 JSON 作为输出格式。所以你要先把使用的模型换成这两个模型中的一个。

然后，你只需要在 Chat Completions 接口中，增加一个参数，指定 response_format={ “type”: “json_object” } 就好了。

除了这两处修改之外，为了确保输出的 JSON 格式和你期望的一样。建议在原来的 Prompt 的最后，再给出一个你期望的 JSON 格式的例子。
这个小技巧有助于最终输出的 JSON 格式和你期望的一样，确保后续程序的解析成功。
如果对比一下这里给出了 JSON 格式例子代码的输出结果和上面没有给例子的输出结果，你会发现，JSON 中对应价格区间的字段 price_range 的输出格式，一个是用了下划线 _ 作为单词之间的分割，而另一个则是用了驼峰格式的 priceRange。
如果你的解析代码中，希望使用 price_range，那么在原来的输出结果里是获取不到的。

<br>

## 如何保证输出结果尽量一致
```
def get_fingerprint_response(prompt, seed=42, model=CHAT_COMPLETION_MODEL):
    messages = [
        {"role" : "system", "content" : "You are an useful AI asssitant."},
        {"role" : "user", "content": prompt}
    ]
    response = client.chat.completions.create (
        model=model,
        messages=messages,
        max_tokens=512,
        n=1,
        stop=None,
        seed=seed,
        temperature=0, 
        response_format={ "type": "json_object" },      
    )
    message = response.choices[0].message.content
    fingerpring = response.system_fingerprint
    return fingerpring, message

fingerprint , json_response = get_fingerprint_response(prompt,seed=1)
print(fingerprint)
print(json_response)
```
尽管 temperature 已经设置成了 0，但是不同 seed 输出的结果还是不同的。

为了尽可能地确保每次的输出结果一样，你还需要指定一个 seed 参数。这个 seed 参数是一个随机数的种子。
如果你指定了相同的 seed 参数，把 temperature 设置成 0，并且确保调用模型的其他参数和提示语完全一致。
那么，OpenAI 的输出结果，就会尽可能地一致。

不过，需要注意，OpenAI 在官方文档中，也申明了即使 seed 一致，<strong>它也只是尽可能保障输出结果是一致的，而没有打上 100% 的保票</strong>。

如果你希望通过相同的 seed 参数来保障输出结果是可以反复重现（Reproducible）的，我也推荐你和我一样，把输出结果中的 system_fingerprint 参数单拎出来。
这个参数，是针对你调用模型的各个参数组合的指纹，如果这个值在两次 AI 模型调用中不一样，就意味着你一定有一些参数在两次调用中是不同的。
这个时候，输出的结果不一致是正常现象，并不能说明你的 seed 参数不一样。