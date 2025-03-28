# MCP Server Python Demo
## 启动

当前目录下启动：
```bash
uv run mcp dev main.py # 5173端口会启动一个服务可浏览器访问调试

uv run mcp run main.py
```

在外部启动：
```bash
uv run --with 'mcp[cli]' --with-editable /Users/luke-surface-mac/code/AI-Drawing-Tutorials/catalyst/Agent/achievement mcp run /Users/luke-surface-mac/code/AI-Drawing-Tutorials/catalyst/Agent/achievement/main.py
```
- --with 表示在运行脚本前，先安装某个包及其依赖
- --with-editable 表示以“可编辑模式”安装本地目录中的包

---

## SDK说明
MCP Server 的 Python SDK，分为 FastMCP SDK 和 Low-Lever SDK 两种。FastMCP 是在 Low-Level 的基础上又做了一层封装，不论是写代码，还是项目依赖等，操作起来都更加简单，容易上手。

该示例里使用 FastMCP。

示例等价于 Function Calling，使用函数调用的方式调用工具:
```py
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
    }
]

def get_score_by_name(name):
    if name == "张三":
        return "name: 张三 绩效评分: 85.9"
    elif name == "李四":
        return "name: 李四 绩效评分: 92.7"
    else:
        return "未搜到该员工的绩效"
```
使用 Low-Level SDK，写法会与上面的代码类似，也是要分开。但是使用 FastMCP，就可以写在一起，把工具的描述以字符串的形式写在函数的开头。