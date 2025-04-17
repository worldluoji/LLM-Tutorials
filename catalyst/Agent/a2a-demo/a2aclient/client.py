import os
import sys

# 添加项目根目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '..'))
sys.path.insert(0, project_root)

from common.client import A2AClient, A2ACardResolver
from common.types import TaskState, Task
from common.utils.push_notification_auth import PushNotificationReceiverAuth

import asyncio
from uuid import uuid4
import urllib


async def main():
    try:
        card_resolver = A2ACardResolver("http://localhost:10000")
        card = card_resolver.get_agent_card()

        print("======= Agent Card ========")
        print(card.model_dump_json(exclude_none=True))
        
        client = A2AClient(agent_card=card)

        payload = {
            "id": uuid4().hex,
            "sessionId": uuid4().hex,
            "acceptedOutputModes": ["text"],
            "message": {
            "role": "user",
            "parts": [
                {  
                    "type": "text",
                    "text": "张三的绩效是多少分？",
                }
            ],
            },
        }

        ret=await client.send_task(payload=payload)
        print(ret.model_dump_json())
    except Exception as e:
        print(f"Error occurred: {str(e)}")


if __name__ == "__main__":
    asyncio.run(main())