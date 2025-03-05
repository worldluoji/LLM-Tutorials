# OpenAI API learning

## 1. Completion
OpenAI 一开始就只提供了 Completion 和 Embedding 两个接口。
Completion 接口，一方面可以直接拿来作为一个聊天机器人，
另一方面，你只要善用提示词，就能完成合理的文案撰写、文本摘要、机器翻译等一系列的工作。
-> 3. completion

如果你想写一些新功能和新代码，建议不要再使用上面的 Completions API 了，因为这一系列的 API 已经被 OpenAI 打上了“Legacy”的标记。而且，OpenAI 也没有为 GPT-4 这个最强大模型，提供 Completions API。

如果今天你想要实现让 GPT 给你写文案和标题的能力，我推荐你使用 Chat Completions 接口，你只需要把你的指令需求替换成一个用户通过 chat 对话向 AI 发出请求的方式就可以了。

## 2. Embedding
Embedding 向量适合作为一个中间结果，用于传统的机器学习场景，比如分类、聚类。
-> 2. embedding
-> 5. aggregation

## 3.  ChatCompletion
在 2023 年 3 月 2 日，因为 ChatGPT 的火热，OpenAI 放出了一个直接可以进行对话聊天的接口。
这个接口叫做 ChatCompletion，对应的模型叫做 gpt-3.5-turbo，不但用起来更容易了，速度还快，
而且价格也是我们之前使用的 text-davinci-003 的十分之一，可谓是物美价廉了。

## 4. moderate
OpenAI 专门提供了一个 moderate 接口，可以让你对输入以及返回的内容做个检查。
如果出现了不健康的内容，你也可以屏蔽这些用户的访问，也可以人工审核一下用户的问题。
-> "6. moderate"

## 5. llama-index
通过llama-index ，将外部的资料库索引入后进行问答
-> 8. llama-index

## 6. LLMChain
通过 Langchain 这个开源库，对大语言模型进行链式调用 
-> 9. LLMChain

## 7. openai有哪些engine?
-> openai-engines

<br>

## preparation
1. 更新pip
```
python3 -m pip install --upgrade pip
python3 -m spacy download zh_core_web_sm
```
2. 设置pip镜像(optional)
```
pip3 config set global.index-url https://mirrors.aliyun.com/pypi/simple
```
3. 安装依赖
```
pip3 install -r requirements.txt
```
The requirements.txt was created by command "pip3 freeze > requirements.txt"


## API兼容性
因为 OpenAI 是行业标杆，因此后续几乎所有的模型厂商的 API 都是兼容 OpenAI 数据格式的，都可以直接使用OpenAI SDK。

如果 base_url 不设置，由于使用了 OpenAI SDK，就会默认请求 OpenAI 的服务。如果使用的阿里云百炼，base_url 需要改为百炼服务器的地址：
```py
client = OpenAI(
    api_key=os.getenv("AliDeep"),  
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
)
```