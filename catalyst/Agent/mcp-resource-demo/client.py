import asyncio
import sys
from mcp import ClientSession, StdioServerParameters
from mcp.types import Notification, Resource
from mcp.client.stdio import stdio_client

async def main():
    # 检查命令行参数 - 必须通过两个参数启动此程序，一个当前客户端，一个服务器程序
    if len(sys.argv) < 2:
        print("Usage: python simple_client.py <path_to_server_script>")
        sys.exit(1)

    server_script = sys.argv[1]
    # 使用服务器的 Python 解释器来启动 Server，而不是当前客户端的Python环境
    params = StdioServerParameters(
        command="python3",
        args=[server_script],
        env=None
    )

    # 建立 stdio 传输并创建 Session
    async with stdio_client(params) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            # 初始化握手
            await session.initialize()
            # 发送初始化完成通知
            notification = Notification(
                method="notifications/initialized",
                params={}
            )
            await session.send_notification(notification)

            # 列出资源
            response = await session.list_resources()
            print("资源列表：")
            # 打印返回格式
            print(f"返回类型: {type(response)}")
            print(f"返回内容: {response}")
            
            # 简化处理资源列表
            resources = getattr(response, 'resources', response)
            for res in resources:
                print(f"- URI: {res.uri}, Name: {res.name}")

if __name__ == "__main__":
    asyncio.run(main())
