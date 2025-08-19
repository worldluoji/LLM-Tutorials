import sys
import asyncio
from mcp import ClientSession
from mcp.client.stdio import stdio_client, StdioServerParameters
from openai import OpenAI
import os
from dotenv import load_dotenv
import mcp.types as types
import json

load_dotenv()

'''
客户端的关键任务是，首先解析采样请求，然后转换为特定语言模型 API 的格式，
调用语言模型获取回答，并给予用户审核答案和修改结果的控制灵活性。
'''
class FileSystemAssistantClient:
    def __init__(self):
        self.session = None
        self.transport = None
        self.client = OpenAI(
            api_key=os.getenv("deepseek"),
            base_url="https://api.deepseek.com"
        )
        self.prompts = None

    async def connect(self, server_script: str):
        # 1) 构造参数对象
        params = StdioServerParameters(
            command="python3",
            args=[server_script],
            cwd="."  # 设置工作目录薇当前目录
        )
        # 2) 保存上下文管理器
        self.transport = stdio_client(params)
        # 3) 进入上下文，拿到 stdio, write
        self.stdio, self.write = await self.transport.__aenter__()

        # 4) 初始化 MCP 会话
        self.session = await ClientSession(self.stdio, self.write).__aenter__()
        await self.session.initialize()
        
        # 5) 获取可用的提示模板
        self.prompts = await self.session.list_prompts()
        print("可用提示模板：")
        for prompt in self.prompts:
            if hasattr(prompt, 'name') and hasattr(prompt, 'description'):
                print(f"- {prompt.name}: {prompt.description}")
            else:
                print(f"- 未知提示模板: {prompt}")

    async def use_prompt(self, prompt_name: str, arguments: dict[str, str]):
        # 获取提示内容
        prompt_result = await self.session.get_prompt(prompt_name, arguments)
        
        # 解析服务器发送的采样请求
        sampling_request_json = prompt_result.messages[0].content.text
        sampling_request = json.loads(sampling_request_json)
        
        # 检查是否是采样请求
        if sampling_request.get("method") == "sampling/createMessage":
            params = sampling_request.get("params", {})
            
            # 显示采样请求给用户
            print("\n服务器发送的采样请求：")
            print(f"方法: {sampling_request.get('method')}")
            print(f"系统提示: {params.get('systemPrompt', '')}")
            print(f"温度: {params.get('temperature', 0.7)}")
            print(f"最大令牌数: {params.get('maxTokens', 1000)}")
            
            # 让用户确认或修改采样请求
            print("\n是否要修改采样参数？(y/n)")
            if input("> ").lower() == 'y':
                print("\n请输入新的 temperature (0.0-1.0):")
                params["temperature"] = float(input("> "))
                print("\n请输入新的 maxTokens:")
                params["maxTokens"] = int(input("> "))

            # 构建DeepSeek API请求
            messages = []
            
            # 添加系统提示（如果存在）
            if "systemPrompt" in params and params["systemPrompt"]:
                messages.append({"role": "system", "content": params["systemPrompt"]})
                
            # 添加对话消息
            for msg in params.get("messages", []):
                if msg.get("content", {}).get("type") == "text":
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", {}).get("text", "")
                    })
            
            # 调用LLM
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,
                temperature=params.get("temperature", 0.7),
                max_tokens=params.get("maxTokens", 1000)
            )
            
            # 显示采样结果给用户
            print("\n采样结果：")
            sampling_result = {
                "model": "deepseek-chat",
                "stopReason": "endTurn",
                "role": "assistant",
                "content": {
                    "type": "text",
                    "text": response.choices[0].message.content
                }
            }
            print(json.dumps(sampling_result, indent=2, ensure_ascii=False))

            # 让用户确认或修改结果
            print("\n是否要修改结果？(y/n)")
            if input("> ").lower() == 'y':
                print("\n请输入修改后的结果：")
                sampling_result["content"]["text"] = input("> ")
            
            return sampling_result["content"]["text"]
        else:
            # 如果不是采样请求，直接返回内容
            return prompt_result.messages[0].content.text

    async def close(self):
        if self.session:
            await self.session.__aexit__(None, None, None)
        if self.transport:
            await self.transport.__aexit__(None, None, None)

async def main():
    print(">>> 开始初始化文件系统助手")
    if len(sys.argv) < 2:
        print("用法: python client.py <server.py 路径>")
        return

    client = FileSystemAssistantClient()
    try:
        await client.connect(sys.argv[1])
        print(">>> 系统连接成功")

        while True:
            print("\n请输入您的问题（输入'退出'结束）：")
            question = input("> ")
            
            if question.lower() == "退出":
                break
                
            print("\n正在处理您的问题...")
            response = await client.use_prompt("file-system-assistant", {
                "question": question
            })
            print("\n最终回答：\n", response)

    except Exception as e:
        print(f"发生错误: {e}")
    finally:
        await client.close()
        print(">>> 系统已关闭")

if __name__ == "__main__":
    asyncio.run(main())