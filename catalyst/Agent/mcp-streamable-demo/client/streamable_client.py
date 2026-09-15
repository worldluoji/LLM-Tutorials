"""MCP Streamable HTTP 客户端 — 使用官方 SDK 高级 API

对应 7. Streamable Http.md 中的"客户端 POST /mcp 发 JSON-RPC，服务器可返回 JSON 或 SSE"。

运行前先启动服务端：
  uv run server/main.py                       # 默认 8000
  uv run server/main.py --port 8765           # 改端口

运行：
  uv run client/streamable_client.py
  uv run client/streamable_client.py --url http://127.0.0.1:8765/mcp
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--url",
        default=os.getenv("MCP_SERVER_URL", "http://127.0.0.1:8000/mcp"),
        help="MCP Streamable HTTP 端点",
    )
    return p.parse_args()


async def main() -> None:
    args = parse_args()
    print(f"== 连接 {args.url} ==")
    async with streamablehttp_client(url=args.url) as (
        read_stream,
        write_stream,
        get_session_id,
    ):
        # streamablehttp_client 返回的第三个回调 get_session_id() 用于在握手后
        # 拿到服务器发回的 Mcp-Session-Id；之后所有请求都要在 headers 里带上。
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            sid = get_session_id()
            print(f"握手完成，session_id = {sid!r}")

            # 1) 列出工具
            tools = await session.list_tools()
            print("\n== 服务端工具 ==")
            for t in tools.tools:
                print(f"  - {t.name}: {t.description}")

            # 2) 调用一个瞬时工具（看默认 SSE 回包能否成功解码）
            print("\n== 调用 add(2, 3) ==")
            result = await session.call_tool("add", {"a": 2, "b": 3})
            for block in result.content:
                if hasattr(block, "text"):
                    print(f"  text: {block.text}")
                else:
                    print(f"  block: {block!r}")

            # 3) 调用 get_weather，验证参数序列化
            print("\n== 调用 get_weather('beijing') ==")
            result = await session.call_tool("get_weather", {"city": "beijing"})
            for block in result.content:
                if hasattr(block, "text"):
                    print(f"  text: {block.text}")

            # 4) 调用 slow_task，看进度通知
            #    默认流式响应下，进度通知会通过 SSE push 过来；
            #    服务端是 logging level 默认 INFO，前端进度会出现在 mcp_messages 日志里。
            print("\n== 调用 slow_task(2.0)，会跑 2 秒 ==")
            result = await session.call_tool("slow_task", {"seconds": 2.0})
            for block in result.content:
                if hasattr(block, "text"):
                    print(f"  text: {block.text}")

            print("\n== 完成 ==")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
