from mcp.server import Server
import mcp.types as types
import asyncio
from mcp.server.stdio import stdio_server
import json

# 定义可用的提示模板
PROMPTS = {
    "file-system-assistant": types.Prompt(
        name="file-system-assistant",
        description="文件系统助手，可以回答关于文件系统的问题",
        arguments=[
            types.PromptArgument(
                name="question",
                description="用户的问题",
                required=True
            )
        ]
    )
}

# 初始化服务器
app = Server("file-system-assistant")

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
    
    if name == "file-system-assistant":
        question = arguments.get("question") if arguments else ""
        
        # 构建采样请求 - 格式符合sampling/createMessage, 这段代码的核心是将用户的问题封装在采样请求中，并将该请求作为提示结果返回给客户端。
        sampling_request = {
            "method": "sampling/createMessage",
            "params": {
                "messages": [
                    {
                        "role": "user",
                        "content": {
                            "type": "text",
                            "text": question
                        }
                    }
                ],
                "modelPreferences": {
                    "hints": [{"name": "deepseek-chat"}],
                    "costPriority": 0.5,
                    "speedPriority": 0.7,
                    "intelligencePriority": 0.8
                },
                "systemPrompt": "你是一个专业的文件系统助手，可以帮助用户了解文件系统的状态和内容。",
                "includeContext": "thisServer",
                "temperature": 0.7,
                "maxTokens": 1000,
                "stopSequences": ["\n\n"],
                "metadata": {
                    "requestType": "file-system-query"
                }
            }
        }
        
        return types.GetPromptResult(
            messages=[
                types.PromptMessage(
                    role="assistant",
                    content=types.TextContent(
                        type="text",
                        text=json.dumps(sampling_request, ensure_ascii=False)
                    )
                )
            ]
        )
    
    raise ValueError(f"未实现提示模板 '{name}' 的处理逻辑")

async def main():
    print("文件系统助手已启动，等待连接...")
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )

if __name__ == "__main__":
    asyncio.run(main())