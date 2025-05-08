from llm import DeepSeek
from tools import get_stock_info

# LangGraph 官方提供了 MessagesState，其实现就是一个 messages 字典
from langgraph.graph import MessagesState,StateGraph,START,END
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
from typing_extensions import Literal

import os

tools = [get_stock_info]
tools_by_name = {tool.name: tool for tool in tools}
llm = DeepSeek().bind_tools(tools)

def llm_call(state: MessagesState):
    """LLM decides whether to call a tool or not"""
    
    # 创建消息列表
    messages = [
        SystemMessage(
            content="你是一个股票助手，如果用户询问股票代码或股票名称，请直接给出代码或名称，而不要给出其他信息"
        )
    ] + state["messages"]
    
    # 调用 LLM, response 就是大模型返回的选择了什么工具的信息。
    response = llm.invoke(messages)
    
    # 简化写法，直接返回了 “messages”: [response]，这样写等同于追加到 state，LangGraph 会自动帮我们合并。
    return {
        "messages": [response]
    }


def tool_node(state: dict):
    """Performs the tool call"""

    result = []
    for tool_call in state["messages"][-1].tool_calls:
        tool = tools_by_name[tool_call["name"]]
        observation = tool.invoke(tool_call["args"])
        # 将观察结果转换为字符串格式
        if isinstance(observation, list):
            # 如果是列表，将其转换为字符串表示
            observation = str(observation)

        result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
    return {"messages": result}


'''
读取最后一条 message，如果有 tool_calls，就返回 “Action”，如果没有就返回 “END”。
“Action” 对应的是 “environment”，也就是执行工具的节点。
“END” 对应的 END，也就是结束节点。
'''
def should_continue(state: MessagesState) -> Literal["environment", "END"]:
    """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""
    messages = state["messages"]
    last_message = messages[-1]
    # If the LLM makes a tool call, then perform an action
    if last_message.tool_calls:
        return "Action"
    # Otherwise, we stop (reply to the user)
    return "END"


# Build workflow
agent_builder = StateGraph(MessagesState)

# Add nodes
agent_builder.add_node("llm_call", llm_call)
agent_builder.add_node("environment", tool_node)

# Add edges to connect nodes
agent_builder.add_edge(START, "llm_call")

# 条件边需要做条件分支判断，那就肯定也需要有一个条件节点，来处理这些逻辑
agent_builder.add_conditional_edges(
    "llm_call",
    should_continue,
    {
        # Name returned by should_continue : Name of next node to visit
        "Action": "environment",
        "END": END,
    },
)
agent_builder.add_edge("environment", "llm_call")

# Compile the agent
agent = agent_builder.compile()

# if not os.path.exists("agent_graph.png"):
#     from IPython.display import Image, display

#     # Show the agent
#     display(Image(agent.get_graph(xray=True).draw_mermaid_png()))

#     # 保存流程图到文件
#     graph_png = agent.get_graph(xray=True).draw_mermaid_png()
#     with open("agent_graph.png", "wb") as f:
#         f.write(graph_png)

# Invoke
messages = [HumanMessage(content="300750 是哪只股票的代码？")]
messages = agent.invoke({"messages": messages})
for m in messages["messages"]:
    m.pretty_print()