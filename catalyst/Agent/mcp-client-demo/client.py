from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Create server parameters for stdio connection
server_params = StdioServerParameters(
    command="uv", # Executable
    args=[
        "run",
        "--with",
        "mcp[cli]",
        "--with-editable",
        "/Users/luke-surface-mac/code/AI-Drawing-Tutorials/catalyst/Agent/achievement",
        "mcp",
        "run",
        "/Users/luke-surface-mac/code/AI-Drawing-Tutorials/catalyst/Agent/achievement/main.py"
    ],# Optional command line arguments
    env=None # Optional environment variables
)

# stdio_client  负责启动服务器进程并建立双向通信通道，它返回用于读写数据的流对象。
# ClientSession  则在这些流的基础上提供高层的会话管理，包括初始化连接、维护会话状态等
async def run():
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            # Initialize the connection
            await session.initialize()

            # List available tools
            tools = await session.list_tools()
            print("Tools:", tools)

            # call a tool
            score = await session.call_tool(name="get_score_by_name",arguments={"name": "张三"})
            print("score: ", score)


if __name__ == "__main__":
    import asyncio
    asyncio.run(run())