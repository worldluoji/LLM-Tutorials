# MCP Server Python Demo
Roo Code 充当了MCP Hosts的角色。

## 启动

当前目录下启动：
```bash
uv run mcp dev main.py # 5173端口会启动一个服务，可浏览器访问该页面调试

uv run mcp run main.py
```

### mcp run vs mcp dev 的区别
uv run mcp run main.py：
- 直接启动MCP服务器
- 服务器通过stdio（标准输入/输出）与客户端通信
- 适用于生产或直接使用场景
- uv run mcp dev main.py：

### 启动开发模式的MCP服务器
- 通常会在特定端口（如5173）启动一个HTTP服务
- 提供浏览器调试界面
- 主要用于开发和调试

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

## Roo Code 配置
```json
{
  "mcpServers": {
    "achievement": {
      "command": "uv",
      "args": [
        "run",
        "--with",
        "mcp[cli]",
        "--with-editable",
        "/Users/luke-surface-mac/code/LLM-Tutorials/catalyst/Agent/mcp-hello/achievement",
        "mcp",
        "run",
        "/Users/luke-surface-mac/code/LLM-Tutorials/catalyst/Agent/mcp-hello/achievement/main.py"
      ]
    }
  }
}
```
这样在Roo Code中问张三和李四谁的绩效成绩更好，就会用到我们的开发的这个简单的MCP Server。


如果是调试，也可以用开发模式启动MCP Server, 在Roo Code中配置：
```json
{
  "mcpServers": {
    "achievement": {
      "url": "http://localhost:3000/sse?transportType=stdio&command=uv&args=run+--with+mcp+mcp+run+%2FUsers%2Fluke-surface-mac%2Fcode%2FAI-Drawing-Tutorials%2Fcatalyst%2FAgent%2Fachievement%2Fmain.py&env=%7B%22HOME%22%3A%22%2FUsers%2Fluke-surface-mac%22%2C%22LOGNAME%22%3A%22luke-surface-mac%22%2C%22PATH%22%3A%22%2FUsers%2Fluke-surface-mac%2F.npm%2F_npx%2F5a9d879542beca3a%2Fnode_modules%2F.bin%3A%2FUsers%2Fluke-surface-mac%2Fnode_modules%2F.bin%3A%2FUsers%2Fnode_modules%2F.bin%3A%2Fnode_modules%2F.bin%3A%2Fusr%2Flocal%2Flib%2Fnode_modules%2Fnpm%2Fnode_modules%2F%40npmcli%2Frun-script%2Flib%2Fnode-gyp-bin%3A%2FUsers%2Fluke-surface-mac%2F.cache%2Fuv%2Farchive-v0%2FowJ-LRbJ4gSFrvzlIibhR%2Fbin%3A%2Fusr%2Flocal%2Fbin%3A%2FUsers%2Fluke-surface-mac%2F.local%2Fbin%3A%2Fusr%2Flocal%2Fbin%3A%2FUsers%2Fluke-surface-mac%2F.local%2Fstate%2Ffnm_multishells%2F58151_1743146928979%2Fbin%3A%2Fusr%2Flocal%2Fopt%2Fopenjdk%4017%2Fbin%3A%2FApplications%2FXcode.app%2FContents%2FDeveloper%2Fusr%2Fbin%3A%2Fusr%2Flocal%2Fopt%2Fruby%403.3%2Fbin%3A%2Fusr%2Flocal%2Fopt%2Fgradle%2Fbin%3A%2Fusr%2Flocal%2Fbin%3A%2Fusr%2Flocal%2Fsbin%3A%2FSystem%2FCryptexes%2FApp%2Fusr%2Fbin%3A%2Fusr%2Fbin%3A%2Fbin%3A%2Fusr%2Fsbin%3A%2Fsbin%3A%2Fvar%2Frun%2Fcom.apple.security.cryptexd%2Fcodex.system%2Fbootstrap%2Fusr%2Flocal%2Fbin%3A%2Fvar%2Frun%2Fcom.apple.security.cryptexd%2Fcodex.system%2Fbootstrap%2Fusr%2Fbin%3A%2Fvar%2Frun%2Fcom.apple.security.cryptexd%2Fcodex.system%2Fbootstrap%2Fusr%2Fappleinternal%2Fbin%3A%2FLibrary%2FApple%2Fusr%2Fbin%3A%2FUsers%2Fluke-surface-mac%2Fdev%2Fandroid-sdk%2Fplatform-tools%2F%3A%2FUsers%2Fluke-surface-mac%2Fdev%2Fandroid-sdk%2Fcmdline-tools%2Flatest%2Fbin%2F%3A%2FUsers%2Fluke-surface-mac%2Fdev%2Fandroid-sdk%2Fbuild-tools%3A%2FUsers%2Fluke-surface-mac%2Fdev%2Fandroid-sdk%2Femulator%2F%22%2C%22SHELL%22%3A%22%2Fbin%2Fzsh%22%2C%22TERM%22%3A%22xterm-256color%22%2C%22USER%22%3A%22luke-surface-mac%22%7D"
    }
  }
}
```
在Roo Code中，添加MCP Server的配置，上面的路径是通过
```bash
uv run mcp dev main.py
```
启动的dev服务，端口5173，在浏览器中通过 http://localhost:5173 访问，点击connect按钮，通过浏览器的“网络查”看日志，找到mcp server的url，替换上面的url。