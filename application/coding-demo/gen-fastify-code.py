from typing import List, TypedDict
from langchain.schema import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START,END
from llm import DeepSeek

llm = DeepSeek()


class State(TypedDict):
    main: str
    routes: list[str]
    handlers: list[str]


systemMessage = """
你是一个 typescript 开发者, 擅长使用 fastify 框架, 你将编写基于 fastify 框架的web后端程序
你只需直接输出代码, 不要做任何解释和说明，不要将代码放到 ```typescript ``` 中
"""

def split_route_handler(message:str)->List[str]:
    codes = message.split('###')
    if len(codes) != 2:
        raise Exception("Invalid message format")
    return codes

def route_node(state):
    prompt = """
    生成 fasitfy 的路由代码和 handler 处理函数，它们之间使用字符串'###'隔开
    route_hello:
        GET /hello
    handler_hello:
        输出字符串"hello fasitify!!!"
    """
    message=llm.invoke([SystemMessage(content=systemMessage),HumanMessage(content=prompt)])
    codes = split_route_handler(message.content)

    state["routes"]+=[codes[0]]
    state["handlers"]+=[codes[1]]
    return state

def main_node(state):
    prompt = """
    1.创建fastify对象
    2.拥有路由代码
    {routes}
    handler代码已经生成，无需再进行处理
    3.启动端口为8089
    """

    prompt=prompt.format(routes=state["routes"][-1])
    message=llm.invoke([SystemMessage(content=systemMessage),HumanMessage(content=prompt)])
    state["main"]+=message.content
    return state


if __name__ == "__main__":
    sg = StateGraph(State)

    sg.add_node("route_node", route_node)
    sg.add_node("main_node", main_node)

    sg.add_edge(START, "route_node")
    sg.add_edge("route_node", "main_node")
    sg.add_edge("main_node", END)

    graph = sg.compile()
    code = graph.invoke({"main":"", "routes":[], "handlers":[]})

    print(code["main"])
    for handler in code["handlers"]:
        print(handler)