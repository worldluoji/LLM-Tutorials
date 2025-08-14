# 导入必要的库
import asyncio
import os
import mcp.types as types
from mcp.server import Server
from mcp.server.stdio import stdio_server

# 创建一个MCP服务器实例，名称为"example-server"
app = Server("example-resource-server")

DOC_DIR = "/Users/luke-surface-mac/code/AI-Drawing-Tutorials/catalyst/Agent/mcp-resource-demo/ailment_docs"

# 注册资源列表
@app.list_resources()
async def list_resources() -> list[types.Resource]:
    files = [f for f in os.listdir(DOC_DIR) if f.endswith(".txt")]
    return [
        types.Resource(
            uri=f"file://{os.path.join(DOC_DIR, fname)}",
            name=fname,
            description="医学文档",
            mimeType="text/plain"
        )
        for fname in files
    ]

# 读取资源内容
@app.read_resource()
async def read_resource(uri: str) -> str:
    path = uri.replace("file://", "")
    with open(path, encoding="utf-8") as f:
        return f.read()

async def main():
    async with stdio_server() as streams:
        await app.run(
            streams[0],
            streams[1],
            app.create_initialization_options()
        )

if __name__ == "__main__":
    asyncio.run(main()) 
