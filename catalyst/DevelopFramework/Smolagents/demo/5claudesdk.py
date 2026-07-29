import anyio
from claude_agent_sdk import query
import os

os.environ.setdefault("ANTHROPIC_BASE_URL", "https://api.minimaxi.com/anthropic")
os.environ.setdefault("ANTHROPIC_MODEL", "MiniMax-M3")
os.environ.setdefault("ANTHROPIC_SMALL_FAST_MODEL", "MiniMax-M3")
os.environ.setdefault("ANTHROPIC_API_KEY", os.getenv("OPEN_AI_API_KEY"))

async def main():
    async for message in query(prompt="2+2=?"):
        print(message)

anyio.run(main)