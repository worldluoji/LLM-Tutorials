import anyio
from claude_agent_sdk import ClaudeSDKClient
import os

os.environ.setdefault("ANTHROPIC_BASE_URL", "https://api.minimaxi.com/anthropic")
os.environ.setdefault("ANTHROPIC_MODEL", "MiniMax-M3")
os.environ.setdefault("ANTHROPIC_SMALL_FAST_MODEL", "MiniMax-M3")
os.environ.setdefault("ANTHROPIC_API_KEY", os.getenv("OPEN_AI_API_KEY"))

async def main():
    async with ClaudeSDKClient() as client:
        await client.query("2+2=?")

        # Extract and print response
        async for msg in client.receive_response():
            print(msg)

anyio.run(main)
