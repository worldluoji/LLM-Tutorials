from mcp.server.fastmcp import FastMCP

# Create an MCP server
mcp = FastMCP("achievement")

# Add an get score tool
@mcp.tool()
def get_score_by_name(name: str) -> str:
    """根据员工的姓名获取该员工的绩效得分"""
    if name == "张三":
        return "name: 张三 绩效评分: 85.9"
    elif name == "李四":
        return "name: 李四 绩效评分: 92.7"
    else:
        return "未搜到该员工的绩效"
    
if __name__ == "__main__":
    # Initialize and run the server
    mcp.run()