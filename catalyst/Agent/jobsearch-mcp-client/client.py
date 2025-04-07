from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Create server parameters for stdio connection
server_params = StdioServerParameters(
    command="uv", # Executable
    args=[
        "--directory",
        "/Users/luke-surface-mac/code/AI-Drawing-Tutorials/catalyst/Agent/jobsearch-mcp-server",
        "run",
        "jobsearch-mcp-server"
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

            resume = '''
            以下是我的简历，请帮我匹配合适的工作。
            - 姓名：李四
            - 专业技能：熟悉 AI Agent, React NodeJS 开发
            - 工作经验：5年
            - 教育背景：本科
            - 期望薪资：30K
            '''
            # call a tool
            recomended = await session.call_tool(name="get_job_by_resume",arguments={"jobs": None, "resume": resume})
            print("result: ", recomended)


if __name__ == "__main__":
    import asyncio
    asyncio.run(run())