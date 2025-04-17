from a2aserver.agents.llm import client

tools = [
    {
        "name": "get_score_by_name",
        "description": "使用该工具获取指定员工的绩效评分",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "员工名字",
                }
            },
            "required": ["name"]
        },
    },
    {
        "name": "generating_performance_reviews",
        "description": "根据输入的员工简单评价，生成员工的绩效评语",
        "parameters": {
            "type": "object",
            "properties": {
                "estimation": {
                    "type": "string",
                    "description": "员工的简单评价",
                }
            },
            "required": ["estimation"]
        },
    },
]

def get_score_by_name(name):
    if name == "张三":
        return "name: 张三 绩效评分: 85.9"
    elif name == "李四":
        return "name: 李四 绩效评分: 92.7"
    else:
        return "未搜到该员工的绩效"
    
def generating_performance_reviews(estimation):
    completion = client.chat.completions.create(
        model="deepseek-r1",
        messages=[
            {'role': 'system', 'content': '你是一个公司的领导，请根据我给你的员工的简单评价，生成一段50字左右的评语'},
            {'role': 'user', 'content': estimation},
        ]
    )

    return completion.choices[0].message.content