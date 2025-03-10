# DSPy
DSPy 是 Declarative Self-improving Python （声明式自我改进 Python）的缩写。开发者可以编写组合式 Python 代码，然后使用 DSPy 来教 (所使用的) LLM 生成高质量的输出结果，而不是为 LLM 编写脆弱的提示词。

DSPy 的研究工作于 2022 年 2 月在斯坦福 NLP 课题组启动，第一个版本于 2022 年 12 月作为 DSP 发布，并于 2023 年 10 月发展成为 DSPy。

## 为什么需要DSPy?
好的提示词非常重要，我们确实需要培养一些真正的提示词专家，他们熟悉各种提示词的编写策略，例如 CoT 思维链、ToT 思维树等等，熟悉为各种流行的 LLM 编写提示词的技巧，善于绕开特定 LLM 提示词的陷阱（由于特定 LLM 

培养提示词专家这件事看起来相当艰巨，容易成为一种玄学。一旦一位提示词专家离职了，可能很长时间无法招到或培养出同等水平的提示词专家。项目中的提示词日积月累，越来越多、越来越复杂，维护修改提示词需要投入更多人力，成本越来越高。

官方文档中是这样说的：DSPy 是用于编写代码而非编写提示词的 LLM 应用开发框架。它允许开发者通过快速迭代构建模块化的 AI 系统，并提供优化提示词和模型权重的算法，无论开发者是在构建简单的分类器、复杂的 RAG 管道（RAG pipelines）还是智能体循环（Agent loops）。

开发 Autonomous Agent 应用的技术基础是深度强化学习 DRL（Deep Reinforcement Learning），那么是否有可能把开发 LLM 应用转化为类似 DRL 的优化和迭代过程呢？

DSPy 其实走的就是这条路，它其实是一个机器学习框架。DSPy 就是将开发 LLM 应用转化成一个对 DRL 系统进行持续优化的过程。一个 DSPy 应用的开发过程，更像是一个 AI 应用的开发过程，而不像一个普通业务系统的开发过程。

## 初始化项目
```shell
mkdir -p ~/work/learn_dspy
cd ~/work/learn_dspy
touch README.md
# 创建poetry虚拟环境，一路回车即可
poetry init
```

切换到国内镜像源：
```shell
poetry source add --priority=primary mirrors https://mirror.sjtu.edu.cn/pypi/web/simple
```

## 安装
DSPy 有两种安装方式，官方 Python 库安装和源代码安装。为了体验 DSPy 团队的最新研发成果，在课程中我推荐选择使用源代码来安装。执行以下命令安装 DSPy：
```shell
cd ~/work
git clone https://github.com/stanfordnlp/dspy.git
cd learn_dspy
# poetry add --editable "../dspy"
poetry install --no-root && poetry run pip install -e "../dspy" --config-settings editable_mode=compat
```
DSPy 直接支持通过 ollama 部署的各种开源 LLM
```python
import dspy

lm = dspy.LM('ollama_chat/qwen2.5', api_base='http://localhost:11434', api_key='')
dspy.configure(lm=lm)

math = dspy.ChainOfThought("question -> answer: float")
response = math(question="Two dice are tossed. What is the probability that the sum equals two?")
print(response)
```
在这个例子中，创建了一个 dspy.ChainOfThought 类型的问答模块 math，然后向 math 模块提出了一个问题：掷出两个骰子，总和等于 2 的概率是多少？

## 文档
- https://dspy.ai/learn/
- https://dspy.ai/tutorials/