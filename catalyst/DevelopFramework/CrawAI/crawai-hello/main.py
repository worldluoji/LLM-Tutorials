from crewai import Agent, Crew, Task, LLM
import os

# 配置 DeepSeek LLM
deepseek_llm = LLM(
    model="deepseek/deepseek-chat",  # 或使用 "deepseek-r1" 等具体模型
    api_key=os.getenv("deepseek"),
    base_url="https://api.deepseek.com"
)

# 定义一个简单的 Agent
researcher = Agent(
    role="资深理财专家",
    goal="分析一下当前科大讯飞这只股票是否值得长期投资（十年以上）",
    backstory="你是一位比肩沃伦巴菲特的资深理财专家，你拥有 infinite knowledge",
    llm=deepseek_llm,  # 使用 DeepSeek 模型
    verbose=True
)

# 定义任务
task = Task(
    description="分析一下当前科大讯飞这只股票是否值得长期投资（十年以上）",
    agent=researcher,
    expected_output="一份科大讯飞是否值得长期投资的报告"
)

# 创建 Crew 并执行
crew = Crew(
    agents=[researcher],
    tasks=[task],
    verbose=True
)

# 运行任务
result = crew.kickoff()
print(result)