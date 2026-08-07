import os

import anyio

from claude_agent_sdk import (
    AgentDefinition,
    ClaudeAgentOptions,
    query,
)

# ============================================================
# 1. 环境配置：与项目下其他 claudesdk*.py 保持一致
# ============================================================
os.environ.setdefault("ANTHROPIC_BASE_URL", "https://api.minimaxi.com/anthropic")
os.environ.setdefault("ANTHROPIC_MODEL", "MiniMax-M3")
os.environ.setdefault("ANTHROPIC_SMALL_FAST_MODEL", "MiniMax-M3")
os.environ.setdefault("ANTHROPIC_API_KEY", os.getenv("OPEN_AI_API_KEY"))

PDF_PATH = (
    "/Users/luoji1/code/LLM-Tutorials/catalyst/DevelopFramework/ClaudeAgentSDK/demo/data/financial_statements/002261_2025_annual_report.pdf"
)


# ============================================================
# 2. 两个 SubAgent 定义
#    每个 SubAgent 拥有独立的 prompt、工具集与 skill，
#    既保证上下文隔离，也支持并行化执行。
# ============================================================


def financial_analyzer_agent() -> AgentDefinition:
    """财报 SubAgent：基于 financial-report-analyzer skill 解析 PDF 年报。"""
    return AgentDefinition(
        description="财报分析助手",
        prompt=(
            "你是一个财报分析助手。请阅读用户给出的 PDF 财报路径，"
            "提取关键财务指标、生成可视化分析图表，"
            "并输出一份结构化的投资参考报告。"
        ),
        tools=["Read", "Grep", "Glob", "Bash", "Write", "Edit"],
        # skills=["financial-report-analyzer"],  # 本地未安装，从 ClawHub 安装后可启用
        model="MiniMax-M3",
    )


def risk_alert_agent() -> AgentDefinition:
    """风险 SubAgent：基于 a-share-risk-alert skill 评估 A 股个股风险。"""
    return AgentDefinition(
        description="A股个股风险分析助手",
        prompt=(
            "你是 A 股个股风险分析助手。请评估目标股票的风险状况，"
            "包括 ST 预警、退市风险、公司负面舆情、监管处罚、诉讼公告等，"
            "并给出最终的风险评级与规避建议。"
        ),
        tools=["Read", "Grep", "Glob", "Bash", "Write", "Edit", "WebFetch"],
        # skills=["a-share-risk-alert"],  # 本地未安装，从 ClawHub 安装后可启用
        model="MiniMax-M3",
    )


agents_config = {
    "financial-analyzer": financial_analyzer_agent(),
    "a-share-risk-alert": risk_alert_agent(),
}


# ============================================================
# 3. 任务 prompt：直接使用字符串，避免 async generator 的解析歧义
# ============================================================
TASK_PROMPT = (
    "我们公司想对拓维信息（002261）做一份深度的投资分析报告。"
    "请完成以下两个任务：\n"
    f"1. 请使用 financial-analyzer agent，阅读 {PDF_PATH}，之后进行财务分析。\n"
    f"2. 请使用 a-share-risk-alert agent，对拓维信息进行风险分析。\n"
    "最终请将两个任务的分析结果整合成一份完整的投资分析报告，保存为mardown文件"
)


# ============================================================
# 4. 主 Agent：使用 query() 驱动
#    include_partial_messages=False：避免 SDK 把中间 AssistantMessage 过滤掉，
#    这样能看到 SubAgent 调用的完整过程。
# ============================================================
async def main() -> None:
    print(
        f"[demo] model={os.environ['ANTHROPIC_MODEL']} "
        f"base_url={os.environ['ANTHROPIC_BASE_URL']} "
        f"pdf={os.path.exists(PDF_PATH)}",
        flush=True,
    )
    try:
        async for message in query(
            prompt=TASK_PROMPT,
            options=ClaudeAgentOptions(
                include_partial_messages=False,
                permission_mode="bypassPermissions",
                allowed_tools=[
                    "Read", "Grep", "Glob", "Bash", "Write", "Edit",
                    "Agent", "AskUserQuestion",
                ],
                agents=agents_config,
            ),
        ):
            print(message, flush=True)
    except Exception as exc:
        import traceback

        print(f"[demo] failed: {exc!r}", flush=True)
        traceback.print_exc()


if __name__ == "__main__":
    anyio.run(main)