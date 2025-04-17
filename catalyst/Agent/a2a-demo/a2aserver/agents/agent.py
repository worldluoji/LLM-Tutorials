import os
import sys

# 添加项目根目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../..'))
sys.path.insert(0, project_root)

import json
import re
import asyncio
from a2aserver.agents.llm import client
from a2aserver.agents.prompt import REACT_PROMPT
from a2aserver.agents.tools import get_score_by_name, generating_performance_reviews, tools

def send_messages(messages):
    response = client.chat.completions.create(
        model="deepseek-v3",
        messages=messages,
    )
    return response

class AgentAdapter:
    """
    适配器类，将现有的agent功能适配到A2A服务器所需的接口
    """
    # 定义支持的内容类型
    SUPPORTED_CONTENT_TYPES = ["text", "text/plain"]

    def invoke(self, query, session_id=None):
        """
        非流式处理请求的方法
        
        Args:
            query: 用户查询
            session_id: 会话ID
            
        Returns:
            dict: 包含content和require_user_input的字典
        """
        prompt = REACT_PROMPT.replace("{tools}", json.dumps(tools)).replace("{input}", query)
        messages = [{"role": "user", "content": prompt}]
        
        while True:
            response = send_messages(messages)
            response_text = response.choices[0].message.content

            print("大模型的回复：")
            print(response_text)

            final_answer_match = re.search(r'Final Answer:\s*(.*)', response_text)
            if final_answer_match:
                final_answer = final_answer_match.group(1)
                print("最终答案:", final_answer)
                break

            messages.append(response.choices[0].message)

            action_match = re.search(r'Action:\s*(\w+)', response_text)
            action_input_match = re.search(r'Action Input:\s*({.*?}|".*?")', response_text, re.DOTALL)

            if action_match and action_input_match:
                tool_name = action_match.group(1)
                params = json.loads(action_input_match.group(1))

                observation = ""
                if tool_name == "get_score_by_name":
                    observation = get_score_by_name(params['name'])
                    print("人类的回复：Observation:", observation)         
                elif tool_name == "generating_performance_reviews":
                    observation = generating_performance_reviews(params['estimation'])
                    print("人类的回复：Observation:", observation)

                messages.append({"role": "user", "content": f"Observation: {observation}"})
            
        return {
            "is_task_complete": True,
            "require_user_input": False,
            "content": final_answer
        }
    
    async def stream(self, query, session_id=None):
        """
        流式处理请求的方法
        
        Args:
            query: 用户查询
            session_id: 会话ID
            
        Yields:
            dict: 包含content、is_task_complete和require_user_input的字典
        """
        prompt = REACT_PROMPT.replace("{tools}", json.dumps(tools)).replace("{input}", query)
        messages = [{"role": "user", "content": prompt}]
        
        response = send_messages(messages)
        response_text = response.choices[0].message.content
        
        # 检查是否需要用户输入
        require_user_input = "Action:" in response_text and "Action Input:" in response_text
        
        # 提取最终答案
        final_answer_match = re.search(r'Final Answer:\s*(.*)', response_text, re.DOTALL)
        if final_answer_match:
            final_answer = final_answer_match.group(1).strip()
        else:
            final_answer = response_text
            
        # 模拟流式输出，将最终答案分成多个部分
        parts = final_answer.split(". ")
        for i, part in enumerate(parts):
            if i < len(parts) - 1:
                yield {
                    "content": part + ". ",
                    "is_task_complete": False,
                    "require_user_input": False
                }
                await asyncio.sleep(0.1)  # 模拟延迟
        
        # 最后一部分
        yield {
            "content": parts[-1] if parts else final_answer,
            "is_task_complete": not require_user_input,
            "require_user_input": require_user_input
        }

# 保留原有的测试代码
if __name__ == "__main__":
    instructions = "你是一个员工绩效评价系统"

    #query = "李四是个好同志，工作态度端正，请帮我给他写一段绩效评语"
    query = "张三和李四的绩效谁好？"
    
    prompt = REACT_PROMPT.replace("{tools}", json.dumps(tools)).replace("{input}", query)
    messages = [{"role": "user", "content": prompt}]

    while True:
        response = send_messages(messages)
        response_text = response.choices[0].message.content

        print("大模型的回复：")
        print(response_text)

        final_answer_match = re.search(r'Final Answer:\s*(.*)', response_text)
        if final_answer_match:
            final_answer = final_answer_match.group(1)
            print("最终答案:", final_answer)
            break

        messages.append(response.choices[0].message)

        action_match = re.search(r'Action:\s*(\w+)', response_text)
        action_input_match = re.search(r'Action Input:\s*({.*?}|".*?")', response_text, re.DOTALL)

        if action_match and action_input_match:
            tool_name = action_match.group(1)
            params = json.loads(action_input_match.group(1))

            observation = ""
            if tool_name == "get_score_by_name":
                observation = get_score_by_name(params['name'])
                print("人类的回复：Observation:", observation)         
            elif tool_name == "generating_performance_reviews":
                observation = generating_performance_reviews(params['estimation'])
                print("人类的回复：Observation:", observation)

            messages.append({"role": "user", "content": f"Observation: {observation}"})