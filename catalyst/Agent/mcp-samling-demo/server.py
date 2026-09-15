from mcp.server.mcpserver import MCPServer, Message
import asyncio
import json

# 初始化服务器
mcp = MCPServer("file-system-assistant")

@mcp.prompt(
    name="file-system-assistant",
    description="文件系统助手，可以回答关于文件系统的问题",
)
async def file_system_assistant(question: str) -> list[Message]:
    """根据用户问题构建采样请求，并以提示消息的形式返回给客户端"""
    # 构建采样请求 - 格式符合 sampling/createMessage。
    # 这段代码的核心是将用户的问题封装在采样请求中，并将该请求作为提示结果返回给客户端。
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
                "hints": [{"name": "deepseek-flash"}],
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

    return [
        Message(
            role="assistant",
            content=json.dumps(sampling_request, ensure_ascii=False),
        )
    ]

async def main():
    print("文件系统助手已启动，等待连接...")
    await mcp.run_stdio_async()

if __name__ == "__main__":
    asyncio.run(main())