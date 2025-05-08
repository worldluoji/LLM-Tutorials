from llm import DeepSeek
from tools import get_stock_info

from langchain_core.messages import HumanMessage

from langgraph.prebuilt import create_react_agent

import os

tools = [get_stock_info]
llm = DeepSeek()

pre_built_agent = create_react_agent(llm, tools=tools)# 保存代理工作流程图到文件graph_png = pre_built_agent.get_graph(xray=True).draw_mermaid_png()with open("agent_graph.png", "wb") as f:    f.write(graph_png)

# if not os.path.exists("agent_graph.png"):
#     graph_png = pre_built_agent.get_graph(xray=True).draw_mermaid_png()
#     # 保存流程图到文件
#     with open("agent_graph.png", "wb") as f:
#         f.write(graph_png)

# Invoke
messages = [HumanMessage(content="300750 是哪只股票的代码？")]
messages = pre_built_agent.invoke({"messages": messages})
for m in messages["messages"]:
    m.pretty_print()