"""MCP Streamable HTTP 服务端示例

默认启动参数：
  - 传输：streamable-http（替代旧的 HTTP+SSE）
  - 端点：http://127.0.0.1:8000/mcp
  - 模式：有状态（服务器返回 Mcp-Session-Id，客户端后续请求要带上）
  - 响应：工具调用默认走 SSE 流式回包；想强制 JSON 可加 --json-response

运行：
  uv run server/main.py                # 默认参数
  uv run server/main.py --port 9000    # 改端口
  uv run server/main.py --stateless    # 无状态模式（适合 Serverless）
  uv run server/main.py --json-response  # 工具调用直接返回 application/json
"""

from __future__ import annotations

import argparse
import asyncio
import time
from datetime import datetime, timezone

from mcp.server.fastmcp import Context, FastMCP


def build_server(stateless: bool, json_response: bool) -> FastMCP:
    mcp = FastMCP(
        name="streamable-demo",
        instructions=(
            "演示 Streamable HTTP 传输的 MCP 服务端。"
            "提供计算器、时间、天气、长任务等工具。"
        ),
        # 与 7. Streamable Http.md 中的字段一一对应：
        host="127.0.0.1",
        port=8000,
        streamable_http_path="/mcp",
        json_response=json_response,
        stateless_http=stateless,
    )

    @mcp.tool()
    def add(a: float, b: float) -> float:
        """把两个数相加。用于演示最基本的工具调用（默认走 SSE 回包）。"""
        return a + b

    @mcp.tool()
    def get_current_time() -> str:
        """返回当前 UTC 时间（ISO 8601）。"""
        return datetime.now(timezone.utc).isoformat()

    @mcp.tool()
    def get_weather(city: str) -> str:
        """根据城市名返回模拟天气数据。

        仅用于演示，不会发起任何网络请求。
        """
        mock_db = {
            "beijing": {"city": "北京", "temp_c": 22, "condition": "晴"},
            "shanghai": {"city": "上海", "temp_c": 26, "condition": "多云"},
            "shenzhen": {"city": "深圳", "temp_c": 30, "condition": "雷阵雨"},
        }
        info = mock_db.get(city.lower())
        if info is None:
            return f"未收录城市: {city}"
        return f"{info['city']}：{info['condition']}，{info['temp_c']}°C"

    @mcp.tool()
    async def slow_task(seconds: float, ctx: Context) -> str:
        """模拟一个耗时任务，期间通过 SSE 推送进度通知。

        这个工具只有在 SSE 流式响应里才能看到 progress 通知。
        把它和 `add` 对比：`add` 瞬时返回，SSE 流只发一个事件；
        `slow_task` 会发多次 progress + 最后的结果。
        """
        steps = max(1, int(seconds))
        for i in range(steps):
            await asyncio.sleep(seconds / steps)
            await ctx.report_progress(
                progress=i + 1,
                total=steps,
                message=f"step {i + 1}/{steps} done",
            )
        return f"slow_task 完成，总耗时 {seconds}s"

    @mcp.resource("demo://greeting/{name}")
    def greeting(name: str) -> str:
        """演示资源读取：返回对指定名字的问候。"""
        return f"你好，{name}！这是来自 Streamable HTTP MCP Server 的问候。"

    return mcp


def main() -> None:
    parser = argparse.ArgumentParser(description="MCP Streamable HTTP Demo Server")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址")
    parser.add_argument("--port", type=int, default=8000, help="监听端口")
    parser.add_argument(
        "--stateless",
        action="store_true",
        help="无状态模式（无 Mcp-Session-Id，适合 Serverless / 多副本）",
    )
    parser.add_argument(
        "--json-response",
        action="store_true",
        help="工具调用强制返回 application/json，而不是 SSE 流",
    )
    args = parser.parse_args()

    mcp = build_server(stateless=args.stateless, json_response=args.json_response)

    mode = "无状态" if args.stateless else "有状态"
    response = "JSON" if args.json_response else "SSE"
    url = f"http://{args.host}:{args.port}/mcp"
    print(f"[server] 启动中... mode={mode} response={response} url={url}")
    print(f"[server] 文档参考：../mcp细节/7. Streamable Http.md")
    print(f"[server] 启动耗时：{time.time():.0f}")

    mcp.settings.host = args.host
    mcp.settings.port = args.port
    mcp.run(transport="streamable-http")


if __name__ == "__main__":
    main()
