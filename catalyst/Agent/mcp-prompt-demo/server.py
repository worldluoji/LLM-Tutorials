from mcp.server import Server
import mcp.types as types
import asyncio
from mcp.server.stdio import stdio_server

# 定义可用的提示模板,模板支持动态参数（比如代码内容和编程语言）。
PROMPTS = {
    "code-review": types.Prompt(
        name="code-review",
        description="分析代码并提供改进建议",
        arguments=[
            types.PromptArgument(
                name="code",
                description="需要审查的代码",
                required=True
            ),
            types.PromptArgument(
                name="language",
                description="编程语言",
                required=True
            ),
            types.PromptArgument(
                name="focus",
                description="审查重点（可选：performance, security, readability）",
                required=False
            )
        ]
    ),
    "explain-code": types.Prompt(
        name="explain-code",
        description="解释代码的工作原理",
        arguments=[
            types.PromptArgument(
                name="code",
                description="需要解释的代码",
                required=True
            ),
            types.PromptArgument(
                name="language",
                description="编程语言",
                required=True
            )
        ]
    ),
    "refactor-code": types.Prompt(
        name="refactor-code",
        description="重构代码",
        arguments=[
            types.PromptArgument(
                name="code",
                description="需要重构的代码",
                required=True
            ),
            types.PromptArgument(
                name="language",
                description="编程语言",
                required=True
            )
        ]
    )
}

# 初始化服务器
app = Server("code-review-server")

@app.list_prompts()
async def list_prompts() -> list[types.Prompt]:
    """返回可用的提示模板列表"""
    return list(PROMPTS.values())

@app.get_prompt()
async def get_prompt(
    name: str, arguments: dict[str, str] | None = None
) -> types.GetPromptResult:
    """根据名称和参数获取提示内容"""
    if name not in PROMPTS:
        raise ValueError(f"提示模板 '{name}' 不存在")
    
    if name == "code-review":
        code = arguments.get("code") if arguments else ""
        language = arguments.get("language") if arguments else "Unknown"
        focus = arguments.get("focus", "general") if arguments else "general"
        
        return types.GetPromptResult(
            messages=[
                types.PromptMessage(
                    role="assistant",
                    content=types.TextContent(
                        type="text",
                        text=f"你是一个专业的代码审查助手，专注于{language}代码的{focus}方面。"
                    )
                ),
                types.PromptMessage(
                    role="user",
                    content=types.TextContent(
                        type="text",
                        text=f"请审查以下{language}代码，并提供改进建议：\n\n{code}"
                    )
                )
            ]
        )
    
    elif name == "explain-code":
        code = arguments.get("code") if arguments else ""
        language = arguments.get("language") if arguments else "Unknown"
        
        return types.GetPromptResult(
            messages=[
                types.PromptMessage(
                    role="assistant",
                    content=types.TextContent(
                        type="text",
                        text=f"你是一个专业的编程导师，擅长解释{language}代码。"
                    )
                ),
                types.PromptMessage(
                    role="user",
                    content=types.TextContent(
                        type="text",
                        text=f"请解释以下{language}代码的工作原理：\n\n{code}"
                    )
                )
            ]
        )
        
    elif name == "refactor-code":
        code = arguments.get("code") if arguments else ""
        language = arguments.get("language") if arguments else "Unknown"
        
        return types.GetPromptResult(
            messages=[
                types.PromptMessage(
                    role="assistant",
                    content=types.TextContent(
                        type="text",
                        text=f"你是一个专业的编程导师，擅长重构{language}代码。"
                    )
                ),
                types.PromptMessage(
                    role="user",
                    content=types.TextContent(
                        type="text",
                        text=f"请重构以下{language}代码：\n\n{code}"
                    )
                )
            ]
        )
    
    raise ValueError(f"未实现提示模板 '{name}' 的处理逻辑")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )

if __name__ == "__main__":
    asyncio.run(main())