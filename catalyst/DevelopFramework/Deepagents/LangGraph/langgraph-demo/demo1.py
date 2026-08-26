from langgraph.graph import StateGraph, START,END

# 节点任务方法，表示了去超市买到了羊排。
def supermarket(state):
    return {"ret": "{}买到了".format(state["ingredients"])}

if __name__ == "__main__":
    # 因为变量通常有多个，在这里我就暂时传入了 dict 字典数据类型。
    sg = StateGraph(dict)

    # 定义第一个超市节点
    sg.add_node("supermarket", supermarket)

    # 分别用两条边将 START（开始节点）和 supermarket 节点，以及 supermarket 节点和 END（结束节点）连接在了一起。
    # 定义起始边
    sg.add_edge(START, "supermarket")
    # 定义结束边
    sg.add_edge("supermarket", END)

    graph = sg.compile()
    ret = graph.invoke({"ingredients": "羊排"})

    print(ret)
