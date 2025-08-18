import sys
import asyncio
from mcp import ClientSession
from mcp.client.stdio import stdio_client, StdioServerParameters
from openai import OpenAI
import os
from dotenv import load_dotenv
import mcp.types as types

load_dotenv()

# 实现了服务器的连接和通信，同时提供交互式的用户界面，支持选择不同的提示模板和参数，最后使用  DeepSeek API 来处理提示并获取响应
class CodeReviewClient:
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
            cwd="."  # 设置工作目录为服务器目录
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

        # 兼容 dict_items
        if not isinstance(self.prompts, dict):
            self.prompts = dict(self.prompts)

        prompt_list = self.prompts.get("prompts", [])

        print("可用提示模板：")
        for prompt in prompt_list:
            if hasattr(prompt, 'name') and hasattr(prompt, 'description'):
                print(f"- {prompt.name}: {prompt.description}")
            else:
                print(f"- 未知提示模板: {prompt}")

    async def use_prompt(self, prompt_name: str, arguments: dict[str, str]):
        # 获取提示内容
        prompt_result = await self.session.get_prompt(prompt_name, arguments)
        
        # 转换消息格式为 OpenAI API 所需的格式
        messages = []
        for msg in prompt_result.messages:
            if isinstance(msg.content, types.TextContent):
                messages.append({
                    "role": msg.role,
                    "content": msg.content.text
                })
        
        # 调用 LLM
        response = self.client.chat.completions.create(
            model="deepseek-chat",
            messages=messages
        )
        
        return response.choices[0].message.content

    async def close(self):
        if self.session:
            await self.session.__aexit__(None, None, None)
        if self.transport:
            await self.transport.__aexit__(None, None, None)


# 负责提供要分析的代码，并根据提示词来设计出一套简单的交互流程。
async def main():
    print(">>> 开始初始化代码审查系统")
    if len(sys.argv) < 2:
        print("用法: python client.py <server.py 路径>")
        return

    client = CodeReviewClient()
    try:
        await client.connect(sys.argv[1])
        print(">>> 系统连接成功")

        # 获取 prompt_list
        prompt_list = client.prompts.get("prompts", [])

        # 示例代码
        sample_code = """
            def calculate_fibonacci(n):
                if n <= 0:
                    return []
                elif n == 1:
                    return [0]
                fib = [0, 1]
                for i in range(2, n):
                    fib.append(fib[i-1] + fib[i-2])
                return fib
        """

        while True:
            print("\n请选择提示模板：")
            for i, prompt in enumerate(prompt_list):
                if hasattr(prompt, 'name') and hasattr(prompt, 'description'):
                    print(f"{i+1}. {prompt.name}: {prompt.description}")
                else:
                    print(f"{i+1}. 未知提示模板: {prompt}")

            print(f"{len(prompt_list)+1}. 退出")
            
            choice = input("> ")
            
            if choice == str(len(prompt_list)+1):
                break
            
            try:
                prompt_index = int(choice) - 1
                if 0 <= prompt_index < len(prompt_list):
                    selected_prompt = prompt_list[prompt_index]
                    prompt_name = getattr(selected_prompt, 'name', None)
                    
                    if not prompt_name:
                        print("无效的提示模板")
                        continue
                    
                    # 动态收集参数
                    arguments = {}
                    if hasattr(selected_prompt, 'arguments'):
                        for arg in selected_prompt.arguments:
                            arg_name = getattr(arg, 'name', '')
                            arg_desc = getattr(arg, 'description', '')
                            arg_required = getattr(arg, 'required', False)
                            
                            # 为常用参数提供默认值
                            if arg_name == "code":
                                arguments[arg_name] = sample_code
                                print(f"使用示例代码作为 {arg_name}")
                            elif arg_name == "language":
                                arguments[arg_name] = "Python"
                                print(f"使用 Python 作为 {arg_name}")
                            elif arg_name == "focus" and not arg_required:
                                print(f"\n请选择 {arg_desc}（可选）：")
                                print("1. performance (性能)")
                                print("2. security (安全性)")
                                print("3. readability (可读性)")
                                print("4. general (综合)")
                                focus_choice = input("> ")
                                focus_map = {
                                    "1": "performance",
                                    "2": "security", 
                                    "3": "readability",
                                    "4": "general"
                                }
                                arguments[arg_name] = focus_map.get(focus_choice, "general")
                            else:
                                # 其他参数需要用户输入
                                required_text = "（必需）" if arg_required else "（可选）"
                                user_input = input(f"请输入 {arg_desc} {required_text}: ")
                                if user_input.strip() or arg_required:
                                    arguments[arg_name] = user_input.strip()
                    
                    print(f"\n正在调用 {prompt_name}...")
                    response = await client.use_prompt(prompt_name, arguments)
                    print(f"\n结果：\n{response}")
                    
                else:
                    print("无效的选择")
            except ValueError:
                print("请输入有效的数字")
            except Exception as e:
                print(f"发生错误: {e}")

    except Exception as e:
        print(f"发生错误: {e}")
    finally:
        await client.close()
        print(">>> 系统已关闭")

if __name__ == "__main__":
    asyncio.run(main()) 