# ollama
Ollama 构建了一个开源大模型的仓库，统一了各个大模型的开发接口，让普通开发者可以非常方便地下载，安装和使用各种大模型。

Linux 环境下安装 Ollama 只需要一个简单的命令行:
```shell
curl -fsSL https://ollama.com/install.sh | sh
```
安装完成后, 用 pull 命令就能下载各个[模型](https://ollama.com/search)。

## 对话模式
可以使用 ollama run 命令进入对话模式，从命令行运行效果看，我们已经可以将其看做命令行版本的 “GPT 大模型”了
```shell
# 对话模式
ollama run llama2-chinese
```

## 接口 API
这里面有一个 Modelfile，它是 Ollama 大模型的配置文件，你可以修改各种配置，然后运行接口程序。比如下面配置了一个基于 Llama2 的大模型，设置了温度，token 数量和系统提示词。
```
FROM llama2
# 设定温度参数为1 [更高的更具有创新性，更低的更富有连贯性]
PARAMETER temperature 1
# 将上下文窗口大小设置为4096，这控制着LLM能够使用多少个token来生成下一个token。
PARAMETER num_ctx 4096

# 设置了自定义系统消息以指定聊天助手的行为。你是马里奥，来自《超级马里奥兄弟》，扮演一名助手的角色。
SYSTEM You are Mario from super mario bros, acting as an assistant.
```
然后，创建一个 Modelfile 文件，在 Linux 中运行自定义的大模型。
```shell
ollama create example -f ./Modelfile
ollama run example
```
还可以用 Python 代码调用大模型的接口。
```python
import requests
import json

# 设置 API 端点
url = "http://localhost:11434/api/chat"

# 定义请求数据
data = {
    "model": "llama2",
    "messages": [
        {"role": "user", "content": "Why is the sky blue?"}
    ]
}

# 发送 POST 请求
response = requests.post(url, headers={"Content-Type": "application/json"}, data=json.dumps(data))

# 检查响应状态码
if response.status_code == 200:
    # 解析并打印响应内容
    response_data = response.json()
    print(response_data['message']['content'])
else:
    print(f"Error: {response.status_code}")
```

## 模型微调
除了接口支持，Ollama 也支持大模型微调。

假设要微调一个小助手，模型微调的核心是整理小助理相关的问题数据集，比如下面这个数据集的例子。
```python
train_data = [
    {"role": "user", "content": "你是谁？", "response": "我是极客时间的小极，一个虚拟客服助手。"},
    {"role": "user", "content": "极客时间是什么？", "response": "极客时间是一个提供技术和职业发展的在线学习平台，拥有丰富的课程和资源。"},
    {"role": "user", "content": "你能做什么？", "response": "我可以回答关于极客时间平台的问题，帮助你找到课程，还可以提供学习建议。"},
    {"role": "user", "content": "如何联系人工客服？", "response": "你可以通过点击页面右下角的“联系客服”按钮来联系人工客服。"},
    {"role": "user", "content": "平台上有哪些课程？", "response": "极客时间提供各种技术和职业发展的课程，包括编程、架构、数据科学等领域的课程。"},
    {"role": "user", "content": "课程需要付费吗？", "response": "是的，极客时间的大部分课程都是需要付费的。你可以在平台上查看具体课程的价格。"},
    {"role": "user", "content": "如何购买课程？", "response": "你可以在课程页面点击“购买”按钮，然后按照提示进行支付即可。"},
    {"role": "user", "content": "课程可以退款吗？", "response": "根据平台的退款政策，购买后7天内可以申请退款，具体请查看平台的退款政策。"}
    ... ...
]
```
还可以使用 Hugging Face 的 transformers 库结合上述数据进行微调, 这样就可以让微调后的大模型学习到小助理日常的对话方式和常见的知识问答。

## reference
https://ollama.com/download/linux