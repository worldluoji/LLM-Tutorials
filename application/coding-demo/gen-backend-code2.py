from typing import List, TypedDict
from langchain.schema import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START,END
from llm import DeepSeek2,DeepSeek
from model_tools import modelsTool
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env")
load_dotenv(dotenv_path=".env.local", override=True)

tools = [modelsTool]
# 阿里的deepseek-v3 api不支持bind_tools，这里改为了使用官网的deepseek-v3
llm = DeepSeek2().bind_tools(tools)

# 调用会误使用tools,而且阿里的写代码更强
llm2 = DeepSeek()

systemMessage = """
你是一个经验丰富的 typescript 开发者, 擅长使用 fastify 框架, 你将编写基于 fastify 框架的web后端程序
你一定只输出代码, 不要做任何解释和说明，一定不要将代码放到 ```typescript ``` 中
"""

models_prompt = """
#模型
生成User相关模型
"""

tools_names = {tool.name: tool for tool in tools}
def models_node(state):
   message=llm.invoke([SystemMessage(content=systemMessage),HumanMessage(content=models_prompt)])
   # print(message)
   # 如果大模型选择了工具，则 content 为空，其会额外用一个结构返回选择的工具的名称以及参数。
   # 经过打印 message 的内容，看到了其是在 tool_calls 中放置了工具名称和参数
   for tool_call in message.tool_calls:        
       tool_name = tool_call["name"]        
       get_tool = tools_names[tool_name]        
       result = get_tool.invoke(tool_call["args"])        
       state["models"].append(result)
   return state



route_prompt = """
#任务
生成 fastify 的路由代码

#路由
1.Get /version 获取应用的版本
2.Get /users 获取用户列表

#规则
字符串分三段，第一段：Method，第二段：请求 PATH，第三段：代码注释

#示例
app.get('/version', versionHandler); // 用于获取应用的版本的路由，handler函数名示例：versionHandler
"""
def route_node(state):
    message=llm2.invoke([SystemMessage(content=systemMessage),HumanMessage(content=route_prompt)])
    #print(message.content)
    state["routes"]+=[message.content]
    return state


handler_prompt = """
#任务
生成 fastify 的路由所对应的 handler 处理函数代码。

#规则
你只需要生成提供的路由代码对应的 handler 函数，不需要生成额外代码
handler函数是和路由代码一一对应的，handler函数的名称在路由代码的注释中已经给出
如果handler函数需要用到模型，则在模型代码中选择

#路由代码
{routes}

#模型代码
{models}


#路由处理函数功能
1.输出应用的版本为1.0
2.输出用户列表
"""

def handler_node(state):
    prompt=handler_prompt.format(routes=state["routes"], models=state["models"])
    message=llm2.invoke([SystemMessage(content=systemMessage),HumanMessage(content=prompt)])
    # print(message)
    state["handlers"]+=[message.content]
    return state


def main_node(state):
    prompt = """
    1.创建fastify对象
    2.拥有路由代码
    {routes}
    handler代码已经生成，无需再进行处理
    3.在8089端口启动服务，不要在别的端口启动
    4.最后注意检查代码，比如不要出现有多个app.listen的情况
    """

    prompt=prompt.format(routes=state["routes"][-1])
    message=llm2.invoke([SystemMessage(content=systemMessage),HumanMessage(content=prompt)])
    state["main"]+=message.content
    return state


class State(TypedDict):
    main: str
    models: list[str]
    routes: list[str]
    handlers: list[str]


if __name__ == "__main__":
    sg = StateGraph(State)

    sg.add_node("models_node", models_node)
    sg.add_node("route_node", route_node)
    sg.add_node("handler_node", handler_node)
    sg.add_node("main_node", main_node)

    sg.add_edge(START, "models_node")
    sg.add_edge("models_node", "route_node")
    sg.add_edge("route_node", "handler_node")
    sg.add_edge("handler_node", "main_node")
    sg.add_edge("main_node", END)

    graph = sg.compile()
    code = graph.invoke({"main":"", "routes":[], "handlers":[], "models":[]})

    print(code["models"][0])
    print(code["main"])
    for handler in code["handlers"]:
        print(handler)