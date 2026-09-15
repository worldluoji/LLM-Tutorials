"""用裸 HTTP 请求演示 Streamable HTTP 的"报文级"工作方式

相比 streamable_client.py 用 SDK 高级 API，这里直接用 httpx 发 POST，
可以直观看到：

- initialize 响应里服务器下发的 `Mcp-Session-Id` 头
- 后续请求必须带上 `Mcp-Session-Id` 与 `Accept: application/json, text/event-stream`
- 工具调用既可以解 SSE 帧，也可以请求 application/json

对应文档：7. Streamable Http.md「核心工作方式」「Accept 头必须同时包含 application/json 和 text/event-stream」

运行前先启动服务端：
  uv run server/main.py                       # 默认 8000
  uv run server/main.py --port 8765           # 改端口

运行：
  uv run client/raw_http_demo.py
  uv run client/raw_http_demo.py --url http://127.0.0.1:8765/mcp
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import httpx


DEFAULT_URL = "http://127.0.0.1:8000/mcp"
MCP_PROTOCOL_VERSION = "2025-06-18"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--url",
        default=os.getenv("MCP_SERVER_URL", DEFAULT_URL),
        help="MCP Streamable HTTP 端点",
    )
    return p.parse_args()


def parse_sse_events(text: str) -> list[dict]:
    """简易 SSE 解析：把 data: 行反序列化成 JSON。"""
    events: list[dict] = []
    for block in text.strip().split("\n\n"):
        for line in block.splitlines():
            if line.startswith("data:"):
                payload = line[len("data:"):].strip()
                if payload:
                    events.append(json.loads(payload))
    return events


def rpc(
    client: httpx.Client,
    url: str,
    method: str,
    params: dict,
    session_id: str | None,
) -> tuple[dict, str | None]:
    """发一条 JSON-RPC 请求并解析响应，自动适配 SSE 或 JSON 回包。"""
    req_id = abs(hash(method)) % 100000
    body = {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
    }
    if session_id:
        headers["Mcp-Session-Id"] = session_id

    r = client.post(url, headers=headers, json=body)
    r.raise_for_status()
    new_sid = r.headers.get("mcp-session-id") or session_id

    ctype = r.headers.get("content-type", "")
    if "text/event-stream" in ctype:
        events = parse_sse_events(r.text)
        # 流式响应里通常第一帧是进度/通知，最后一帧带 id=req_id 的真正结果
        result = next((e for e in events if e.get("id") == req_id), events[-1] if events else {})
    else:
        result = r.json()

    return result, new_sid


def main() -> None:
    args = parse_args()
    server_url = args.url
    print(f"== 裸 HTTP 演示：{server_url} ==\n")
    with httpx.Client(timeout=30) as client:
        # 1) initialize — 这一步服务器会返回 Mcp-Session-Id
        print("[1] initialize（建立 session）")
        init_result, session_id = rpc(
            client,
            server_url,
            "initialize",
            {
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "raw-http-demo", "version": "0.1.0"},
            },
            session_id=None,
        )
        print(f"    serverInfo = {init_result.get('result', {}).get('serverInfo')}")
        print(f"    Mcp-Session-Id = {session_id}")

        # 2) initialized 通知（无 id，服务器回 202 Accepted）
        print("\n[2] notifications/initialized（确认初始化）")
        notif = {"jsonrpc": "2.0", "method": "notifications/initialized"}
        r = client.post(
            server_url,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "Mcp-Session-Id": session_id,
                "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
            },
            json=notif,
        )
        print(f"    HTTP {r.status_code}（通知类响应通常为 202）")

        # 3) tools/list
        print("\n[3] tools/list")
        lst, session_id = rpc(client, server_url, "tools/list", {}, session_id)
        for tool in lst.get("result", {}).get("tools", []):
            print(f"    - {tool['name']}: {tool.get('description', '')[:60]}")

        # 4) tools/call → add
        print("\n[4] tools/call add(2, 3)")
        add_res, session_id = rpc(
            client,
            server_url,
            "tools/call",
            {"name": "add", "arguments": {"a": 2, "b": 3}},
            session_id,
        )
        print(f"    result = {add_res.get('result')}")

        # 5) tools/call → slow_task（看 SSE 多帧）
        print("\n[5] tools/call slow_task(2.0)（会看到多帧 SSE）")
        slow_res, session_id = rpc(
            client,
            server_url,
            "tools/call",
            {"name": "slow_task", "arguments": {"seconds": 2.0}},
            session_id,
        )
        print(f"    result = {slow_res.get('result')}")

        # 6) 演示：故意不带 Mcp-Session-Id，看是否会失败
        print("\n[6] 不带 Mcp-Session-Id 调用 add(1,1)（有状态模式下会失败）")
        try:
            bad, _ = rpc(
                client,
                server_url,
                "tools/call",
                {"name": "add", "arguments": {"a": 1, "b": 1}},
                session_id=None,
            )
            print(f"    结果: {bad}")
            print("    -> 服务端是无状态模式，没强制要求 session id")
        except httpx.HTTPStatusError as e:
            print(f"    HTTP {e.response.status_code}（有状态模式下不带 session id 会被拒绝）")

        print("\n== 完成 ==")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
