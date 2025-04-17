import os
import sys

# 添加项目根目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '..'))
sys.path.insert(0, project_root)

from common.server import A2AServer
from common.types import AgentCard, AgentCapabilities, AgentSkill, MissingAPIKeyError
from common.utils.push_notification_auth import PushNotificationSenderAuth
from agents.agent import SUPPORTED_CONTENT_TYPES, AgentAdapter
from agents.task_manager import AgentTaskManager
import click
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@click.command()
@click.option("--host", "host", default="localhost")
@click.option("--port", "port", default=10000)
def main(host, port):
    """Starts the Currency Agent server."""
    try:
        capabilities = AgentCapabilities(streaming=True, pushNotifications=True)
        skill1 = AgentSkill(
            id="skill1",
            name="员工绩效工具",
            description="查询员工的绩效评分",
            tags=["查询员工的绩效评分"],
            examples=["张三的绩效是多少分"],
        )
        skill2 = AgentSkill(
            id="skill2",
            name="员工绩效评语生成工具",
            description="生成绩效评语",
            tags=["生成绩效评语"],
            examples=["请帮我写一段张三的绩效评语"],
        )
        agent_card = AgentCard(
            name="员工绩效管理系统",
            description="查询员工的绩效评分，生成绩效评语",
            url=f"http://{host}:{port}/",
            version="1.0.0",
            defaultInputModes=AgentAdapter.SUPPORTED_CONTENT_TYPES,
            defaultOutputModes=AgentAdapter.SUPPORTED_CONTENT_TYPES,
            capabilities=capabilities,
            skills=[skill1, skill2],
        )

        notification_sender_auth = PushNotificationSenderAuth()
        notification_sender_auth.generate_jwk()
        server = A2AServer(
            agent_card=agent_card,
            task_manager=AgentTaskManager(agent=AgentAdapter(), notification_sender_auth=notification_sender_auth),
            host=host,
            port=port,
        )

        server.app.add_route(
            "/.well-known/jwks.json", notification_sender_auth.handle_jwks_endpoint, methods=["GET"]
        )

        logger.info(f"Starting server on {host}:{port}")
        server.start()
    except MissingAPIKeyError as e:
        logger.error(f"Error: {e}")
        exit(1)
    except Exception as e:
        logger.error(f"An error occurred during server startup: {e}")
        exit(1)


if __name__ == "__main__":
    main()