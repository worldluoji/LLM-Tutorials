import asyncio
import os
import sys
import json
import argparse
import requests
from datetime import datetime
from typing import Any
from dotenv import load_dotenv
from claude_agent_sdk import (
    ClaudeSDKClient,
    ClaudeAgentOptions,
    AgentDefinition,
    ResultMessage,
    SystemMessage,
    tool,
    create_sdk_mcp_server,
    HookMatcher,
)

load_dotenv()

os.environ.setdefault("ANTHROPIC_BASE_URL", "https://api.kimi.com/coding/")
os.environ.setdefault("ANTHROPIC_MODEL", "kimi-k2.6")
os.environ.setdefault("ANTHROPIC_SMALL_FAST_MODEL", "kimi-k2.6")
os.environ.setdefault("ANTHROPIC_API_KEY", os.getenv("KIMI_API_KEY"))


# ---------- 系统提示词 ----------
SYSTEM_PROMPT = """\
你是燕京啤酒 (000729) 的资深投资分析师。必须使用子 agent 完成任务，**严禁自行调用 Skills**。
分析对象：燕京啤酒 2025 年年报 + 啤酒行业最新动态 + 个股风险信号。
输出格式：建议关注的核心风险点 / 关键财务异常 / 新增行业利好或利空。\
"""


# ---------- SubAgent 定义 ----------
def build_agents() -> dict[str, AgentDefinition]:
    """把三个 SubAgent 集中到一个工厂方法，方便 Fresh / Resume / Fork 三种模式复用。"""
    return {
        "financial-analyzer": AgentDefinition(
            description="财报分析助手",
            prompt="你是一个财报分析助手",
            tools=["Read", "Grep", "Glob", "Bash", "Write", "Edit"],
            skills=["financial-report-analyzer"],
            model="kimi-k2.6",
        ),
        "industry-news-collector": AgentDefinition(
            description="行业信息收集助手",
            prompt="你是一个行业信息收集助手",
            tools=["Read", "Grep", "Glob", "Bash", "Write", "Edit", "WebFetch",
                  "mcp__websearch__bochasearch"],
            skills=["industry-news-collector"],
            model="kimi-k2.6",
        ),
        "a-share-risk-alert": AgentDefinition(
            description="A股个股风险分析助手",
            prompt="你是一个A股个股风险分析助手",
            tools=["Read", "Grep", "Glob", "Bash", "Write", "Edit",
                  "mcp__websearch__bochasearch"],
            skills=["a-share-risk-alert"],
            model="kimi-k2.6",
        ),
    }


# ---------- MCP / Bocha 搜索 ----------
@tool(
    "bochasearch",
    "使用 Bocha AI 进行网络搜索",
    {"query": str},
)
async def bochasearch(args) -> dict[str, Any]:
    bochakey = os.getenv("BOCHA_API_KEY")
    ep = "https://api.bochaai.com/v1/web-search"
    headers = {
        "Authorization": f"Bearer {bochakey}",
        "Content-Type": "application/json",
    }
    data = {
        "query": args["query"],
        "summary": True,
        "count": 10,
    }
    response = requests.post(ep, data=json.dumps(data), headers=headers)
    return {
        "content": [
            {
                "type": "text",
                "text": f"result: {response.json()}",
            }
        ]
    }


websearch_server = create_sdk_mcp_server(
    name="websearch",
    version="1.0.0",
    tools=[bochasearch],
)


# ---------- 默认首次提问 ----------
DEFAULT_PROMPT = """\
请完成以下三个任务：
1. 请使用 financial-analyzer agent，阅读 D:\\workspace\\python\\claude-agent-sdk\\08Subagent\\raw\\燕京啤酒财报.pdf，之后进行财务分析。
2. 请使用 a-share-risk-alert agent，对燕京啤酒进行风险分析。
3. 请使用 industry-news-collector agent，收集最近啤酒行业的新闻热点。

必须使用子 agent 完成任务，**不能自行调用 skills**。"""


# ============================================================
# Hooks：安全策略 + 审计日志 + 子 Agent 追踪
# ============================================================
AUDIT_LOG = "audit_log.jsonl"


async def pre_tool_guard(input_data, tool_use_id, context):
    """PreToolUse：只读自动放行，写操作检查路径，Bash 拒绝危险命令。"""
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {}) or {}

    # 1. 只读工具自动放行
    if tool_name in {"Read", "Glob", "Grep"}:
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "allow",
                "permissionDecisionReason": "Read-only tool auto-approved",
            }
        }

    # 2. 写操作保护 .env 与系统目录
    if tool_name in {"Write", "Edit"}:
        file_path = tool_input.get("file_path", "")
        file_name = file_path.split("/")[-1].split("\\")[-1]
        if file_name == ".env" or file_path.startswith(("/etc", "C:\\Windows")):
            return {
                "systemMessage": f"⚠️ 禁止修改受保护文件：{file_path}",
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": "Cannot modify protected files",
                },
            }

    # 3. Bash 危险命令拦截
    if tool_name == "Bash":
        command = tool_input.get("command", "")
        dangerous = ["rm -rf", "mkfs", ":(){ :|:& };:", "> /dev/sda"]
        if any(d in command for d in dangerous):
            return {
                "systemMessage": f"⚠️ 检测到危险命令：{command}",
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": "Dangerous shell command blocked",
                },
            }

    # 其余工具走默认权限策略
    return {}


async def audit_logger(input_data, tool_use_id, context):
    """PostToolUse：把工具调用记录到审计日志。"""
    record = {
        "ts": datetime.now().isoformat(),
        "session_id": input_data.get("session_id"),
        "agent_id": input_data.get("agent_id"),
        "hook": input_data.get("hook_event_name"),
        "tool_name": input_data.get("tool_name"),
        "tool_use_id": tool_use_id,
        "tool_input": input_data.get("tool_input"),
        "tool_output_summary": str(input_data.get("tool_output", ""))[:500],
    }
    with open(AUDIT_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return {}


async def subagent_tracker(input_data, tool_use_id, context):
    """SubagentStart / SubagentStop：记录子 Agent 的启停与产物路径。"""
    event = input_data.get("hook_event_name")
    agent_id = input_data.get("agent_id", "unknown")
    transcript = input_data.get("agent_transcript_path", "")
    print(f"[{event}] agent_id={agent_id} transcript={transcript}")
    return {}


async def session_archiver(input_data, tool_use_id, context):
    """Stop：会话结束时打印归档信息，可扩展为上传日志。"""
    session_id = input_data.get("session_id", "unknown")
    print(f"\n[SESSION_END] {session_id} 审计日志已写入 {AUDIT_LOG}")
    return {}


# 集中注册所有 hooks
BUILD_HOOKS = lambda: {
    "PreToolUse": [
        HookMatcher(hooks=[pre_tool_guard]),
    ],
    "PostToolUse": [
        HookMatcher(hooks=[audit_logger]),
    ],
    "PostToolUseFailure": [
        HookMatcher(hooks=[audit_logger]),
    ],
    "SubagentStart": [
        HookMatcher(hooks=[subagent_tracker]),
    ],
    "SubagentStop": [
        HookMatcher(hooks=[subagent_tracker]),
    ],
    "Stop": [
        HookMatcher(hooks=[session_archiver]),
    ],
}


# ============================================================
# OpenTelemetry 配置
# ============================================================
def build_otel_env(
    service_name: str = "yanjing-research-agent",
    enduser_id: str = "",
    tenant_id: str = "",
) -> dict[str, str]:
    """构造 OpenTelemetry 环境变量，可传入服务名、用户、租户等标签。"""
    attrs = [
        "service.version=1.0.0",
        "deployment.environment=development",
    ]
    if enduser_id:
        from urllib.parse import quote
        attrs.append(f"enduser.id={quote(enduser_id)}")
    if tenant_id:
        from urllib.parse import quote
        attrs.append(f"tenant.id={quote(tenant_id)}")

    return {
        # 1. 总开关
        "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
        # 2. Traces 需要 beta 开关
        "CLAUDE_CODE_ENHANCED_TELEMETRY_BETA": "1",
        # 3. 为三种信号各选一个 exporter
        "OTEL_TRACES_EXPORTER": "otlp",
        "OTEL_METRICS_EXPORTER": "otlp",
        "OTEL_LOGS_EXPORTER": "otlp",
        # 4. OTLP 传输配置
        "OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf",
        "OTEL_EXPORTER_OTLP_ENDPOINT": os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://116.153.88.50:4318"),
        "OTEL_EXPORTER_OTLP_HEADERS": os.getenv("OTEL_EXPORTER_OTLP_HEADERS", ""),
        # 5. 服务名与资源属性
        "OTEL_SERVICE_NAME": service_name,
        "OTEL_RESOURCE_ATTRIBUTES": ",".join(attrs),
        # 6. 短任务调低导出间隔，避免数据丢失
        "OTEL_METRIC_EXPORT_INTERVAL": "1000",
        "OTEL_LOGS_EXPORT_INTERVAL": "1000",
        "OTEL_TRACES_EXPORT_INTERVAL": "1000",
    }


# ============================================================
# 模式零：Fresh —— 从头开始的一次性分析
# ============================================================
async def run_fresh(prompt: str, otel_env: dict[str, str] | None = None) -> str:
    """从头开始一次分析，跑完把 session_id 吐出来，方便后续 resume / fork。"""
    options = ClaudeAgentOptions(
        system_prompt=SYSTEM_PROMPT,
        include_partial_messages=True,
        mcp_servers={"websearch": websearch_server},
        allowed_tools=[
            "Read", "Grep", "Glob", "Agent", "AskUserQuestion",
            "mcp__websearch__bochasearch",
        ],
        agents=build_agents(),
        hooks=BUILD_HOOKS(),
        env=otel_env or build_otel_env(),
    )

    session_id = None
    async with ClaudeSDKClient(options=options) as client:
        await client.query(prompt)
        async for msg in client.receive_response():
            print(msg)
            if isinstance(msg, ResultMessage):
                session_id = msg.session_id
    return session_id


# ============================================================
# 模式一：Resume —— 接着上次聊
# ============================================================
async def run_resume(session_id: str, follow_up: str, otel_env: dict[str, str] | None = None) -> None:
    """基于历史的 session_id 继续追问。SubAgent 状态、历史消息、Skills 缓存全部复用。"""
    options = ClaudeAgentOptions(
        resume=session_id,
        allowed_tools=[
            "Read", "Grep", "Glob", "Agent", "AskUserQuestion",
            "mcp__websearch__bochasearch",
        ],
        hooks=BUILD_HOOKS(),
        env=otel_env or build_otel_env(),
    )
    async with ClaudeSDKClient(options=options) as client:
        await client.query(follow_up)
        async for msg in client.receive_response():
            print(msg)


# ============================================================
# 模式二：Fork —— 在原会话上派生分支
# ============================================================
async def run_fork(session_id: str, alternative: str, otel_env: dict[str, str] | None = None) -> str:
    """把当前会话完整复制一份给新分支，分支里随便试错，原会话纹丝不动。"""
    options = ClaudeAgentOptions(
        resume=session_id,
        fork_session=True,           # ★ 关键：派生分支
        max_turns=5,
        hooks=BUILD_HOOKS(),
        env=otel_env or build_otel_env(),
    )
    forked_id = None
    async with ClaudeSDKClient(options=options) as client:
        await client.query(alternative)
        async for msg in client.receive_response():
            print(msg)
            if isinstance(msg, ResultMessage):
                forked_id = msg.session_id
    return forked_id


# ============================================================
# CLI 入口
# ============================================================
async def main():
    parser = argparse.ArgumentParser(
        description="燕京啤酒投研 Agent —— 支持 Fresh / Resume / Fork + Hooks + OpenTelemetry"
    )
    parser.add_argument(
        "--resume",
        metavar="SESSION_ID",
        help="从已有 session_id 继续追问",
    )
    parser.add_argument(
        "--fork",
        metavar="SESSION_ID",
        help="基于已有 session_id 派生分支",
    )
    parser.add_argument(
        "--user",
        metavar="USER_ID",
        default="",
        help="当前分析师 ID，用于 OpenTelemetry 用户归因",
    )
    parser.add_argument(
        "--tenant",
        metavar="TENANT_ID",
        default="",
        help="当前租户/团队 ID，用于 OpenTelemetry 用户归因",
    )
    parser.add_argument(
        "prompt",
        nargs="?",
        default=DEFAULT_PROMPT,
        help="要发给主 Agent 的 prompt",
    )
    args = parser.parse_args()

    otel_env = build_otel_env(
        service_name="yanjing-research-agent",
        enduser_id=args.user,
        tenant_id=args.tenant,
    )

    if args.fork:
        forked = await run_fork(args.resume or args.prompt, args.prompt, otel_env)
        print(f"\n[FORK_SESSION_ID] {forked}")
        print("# 之后可以继续基于这个分支追问：")
        print(f"# python agent_with_telemetry.py --resume {forked} \"在 DCF 估值基础上，把永续增长率调到 1% 重新算一下\"")
    elif args.resume:
        await run_resume(args.resume, args.prompt, otel_env)
    else:
        sid = await run_fresh(args.prompt, otel_env)
        print(f"\n[SESSION_ID] {sid}")
        print("# 之后用：")
        print(f"# python agent_with_telemetry.py --resume {sid} \"请补充最新一周行业利空\"")
        print("# 或者开分支探索不同投资逻辑：")
        print(f"# python agent_with_telemetry.py --fork {sid} \"请基于现有分析，额外用 DCF 模型重做估值\"")


if __name__ == "__main__":
    asyncio.run(main())
